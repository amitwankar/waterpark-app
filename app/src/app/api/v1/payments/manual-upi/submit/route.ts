import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { encryptText } from "@/lib/encryption";
import { mergeTransactionMeta, parseTransactionMeta, type PaymentType } from "@/lib/payment";
import { redis } from "@/lib/redis";

const submitSchema = z.object({
  transactionId: z.string().min(8),
  upiRef: z.string().trim().min(6).max(50),
  screenshot: z.string().trim().optional(),
  paymentType: z.enum(["FULL", "DEPOSIT", "SPLIT"]).default("SPLIT"),
});

const QUEUE_LIST_KEY = "upi:queue";
const QUEUE_ITEM_PREFIX = "upi:queue:item:";
const QUEUE_TTL_SECONDS = 24 * 60 * 60;

function hashUtr(utr: string): string {
  return crypto.createHash("sha256").update(utr.trim().toUpperCase()).digest("hex");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = submitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid UPI payload" }, { status: 400 });
  }

  const transaction = await db.transaction.findUnique({
    where: { id: parsed.data.transactionId },
    include: {
      booking: {
        select: {
          id: true,
          bookingNumber: true,
          status: true,
        },
      },
    },
  });

  if (!transaction || !transaction.booking) {
    return NextResponse.json({ message: "Transaction not found" }, { status: 404 });
  }

  if (transaction.method !== "MANUAL_UPI") {
    return NextResponse.json({ message: "This transaction is not manual UPI" }, { status: 409 });
  }

  if (transaction.status === "PAID") {
    return NextResponse.json({ message: "Transaction already paid" }, { status: 409 });
  }

  const utrHash = hashUtr(parsed.data.upiRef);
  const duplicate = await db.transaction.findFirst({
    where: {
      method: "MANUAL_UPI",
      OR: [{ status: "PENDING" }, { status: "PAID" }],
      notes: { contains: `utrHash:${utrHash}` },
      NOT: { id: transaction.id },
    },
    select: { id: true },
  });

  if (duplicate) {
    return NextResponse.json({ message: "Duplicate UPI reference" }, { status: 409 });
  }

  const existingMeta = parseTransactionMeta(transaction.notes);
  const paymentType = (existingMeta?.paymentType ?? parsed.data.paymentType) as PaymentType;

  await db.transaction.update({
    where: { id: transaction.id },
    data: {
      status: "PENDING",
      upiRef: encryptText(parsed.data.upiRef.trim().toUpperCase()),
      upiScreenshot: parsed.data.screenshot || null,
      notes: mergeTransactionMeta(
        [transaction.notes ?? "", `utrHash:${utrHash}`, "Manual UPI proof submitted"].filter(Boolean).join(" | "),
        {
          ...(existingMeta ?? {}),
          paymentType,
          utrHash,
        },
      ),
    },
  });

  await redis.lpush(QUEUE_LIST_KEY, transaction.id);
  await redis.set(
    `${QUEUE_ITEM_PREFIX}${transaction.id}`,
    JSON.stringify({
      transactionId: transaction.id,
      bookingId: transaction.booking.id,
      submittedAt: new Date().toISOString(),
    }),
    "EX",
    QUEUE_TTL_SECONDS,
  );

  return NextResponse.json({
    success: true,
    transactionId: transaction.id,
    bookingId: transaction.booking.id,
    redirectTo: `/guest/payment/pending?bookingId=${transaction.booking.id}`,
  });
}
