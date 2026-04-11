import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptText } from "@/lib/encryption";
import {
  getBookingPaymentSummary,
  mergeTransactionMeta,
  reconcileBookingPaymentState,
  type PaymentType,
} from "@/lib/payment";
import { redis } from "@/lib/redis";

const paymentRowSchema = z.object({
  method: z.enum(["CASH", "MANUAL_UPI", "WRISTBAND"]),
  amount: z.number().positive(),
  upiRef: z.string().trim().min(6).max(50).optional(),
  screenshot: z.string().trim().optional(),
  notes: z.string().trim().max(300).optional(),
});

const collectSchema = z.object({
  payments: z.array(paymentRowSchema).min(1).max(4),
});

const QUEUE_LIST_KEY = "upi:queue";
const QUEUE_ITEM_PREFIX = "upi:queue:item:";
const QUEUE_TTL_SECONDS = 24 * 60 * 60;

function hashUtr(utr: string): string {
  return crypto.createHash("sha256").update(utr.trim().toUpperCase()).digest("hex");
}

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

function getSubRole(session: unknown): string | null {
  const candidate = session as { user?: { subRole?: string | null } };
  return candidate?.user?.subRole ?? null;
}

function getUserId(session: unknown): string | null {
  const candidate = session as { user?: { id?: string } };
  return candidate?.user?.id ?? null;
}

function round(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  const role = getRole(session);
  const subRole = getSubRole(session);
  const actorId = getUserId(session);

  const canCollect = role === "ADMIN" || (role === "EMPLOYEE" && subRole === "TICKET_COUNTER");
  if (!canCollect || !actorId) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = collectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const params = await Promise.resolve(context.params);
  const bookingId = params.id;

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      bookingNumber: true,
      status: true,
      totalAmount: true,
    },
  });
  if (!booking) {
    return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  }

  if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
    return NextResponse.json({ message: "Booking cannot accept more payments" }, { status: 409 });
  }

  const before = await getBookingPaymentSummary(booking.id);
  const requested = round(parsed.data.payments.reduce((acc, row) => acc + row.amount, 0));

  if (requested - before.balanceDue > 1) {
    return NextResponse.json(
      { message: `Payment exceeds remaining balance (remaining: Rs.${before.balanceDue})` },
      { status: 409 },
    );
  }

  const splitGroup = crypto.randomUUID();
  const created: Array<{ id: string; method: string; amount: number; status: string }> = [];

  for (let index = 0; index < parsed.data.payments.length; index += 1) {
    const row = parsed.data.payments[index];
    const splitIndex = index + 1;

    if (row.method === "MANUAL_UPI") {
      if (!row.upiRef) {
        return NextResponse.json({ message: `UPI reference required for row ${splitIndex}` }, { status: 400 });
      }

      const utrHash = hashUtr(row.upiRef);
      const duplicate = await db.transaction.findFirst({
        where: {
          method: "MANUAL_UPI",
          OR: [{ status: "PENDING" }, { status: "PAID" }],
          notes: { contains: `utrHash:${utrHash}` },
        },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json({ message: `Duplicate UPI reference in row ${splitIndex}` }, { status: 409 });
      }

      const tx = await db.transaction.create({
        data: {
          bookingId: booking.id,
          amount: row.amount,
          method: "MANUAL_UPI",
          status: "PENDING",
          upiRef: encryptText(row.upiRef.trim().toUpperCase()),
          upiScreenshot: row.screenshot || null,
          notes: mergeTransactionMeta(
            [row.notes ?? "", `utrHash:${utrHash}`, "Gate split UPI pending verification"].filter(Boolean).join(" | "),
            {
              paymentType: "BALANCE" as PaymentType,
              splitGroup,
              splitPortion: row.amount,
              splitIndex,
              bookingId: booking.id,
              bookingNumber: booking.bookingNumber,
              utrHash,
            },
          ),
        },
        select: { id: true, method: true, amount: true, status: true },
      });

      await redis.lpush(QUEUE_LIST_KEY, tx.id);
      await redis.set(
        `${QUEUE_ITEM_PREFIX}${tx.id}`,
        JSON.stringify({
          transactionId: tx.id,
          bookingId: booking.id,
          submittedAt: new Date().toISOString(),
        }),
        "EX",
        QUEUE_TTL_SECONDS,
      );

      created.push({ id: tx.id, method: tx.method, amount: Number(tx.amount), status: tx.status });
      continue;
    }

    const tx = await db.transaction.create({
      data: {
        bookingId: booking.id,
        amount: row.amount,
        method: row.method,
        status: "PAID",
        verifiedById: actorId,
        verifiedAt: new Date(),
        notes: mergeTransactionMeta([row.notes ?? "", "Gate split collected"].filter(Boolean).join(" | "), {
          paymentType: "BALANCE" as PaymentType,
          splitGroup,
          splitPortion: row.amount,
          splitIndex,
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
        }),
      },
      select: { id: true, method: true, amount: true, status: true },
    });

    created.push({ id: tx.id, method: tx.method, amount: Number(tx.amount), status: tx.status });
  }

  const summary = await reconcileBookingPaymentState({
    bookingId: booking.id,
    incrementCapacityWhenConfirmed: true,
  });

  return NextResponse.json({
    success: true,
    bookingId: booking.id,
    bookingStatus: summary.status,
    totalPaid: summary.totalPaid,
    totalAmount: summary.totalAmount,
    balanceDue: summary.balanceDue,
    transactions: created,
    promptCheckIn: summary.status === "CONFIRMED",
  });
}
