import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  mergeTransactionMeta,
  parseTransactionMeta,
  reconcileBookingPaymentState,
} from "@/lib/payment";
import { redis } from "@/lib/redis";

const verifySchema = z.object({
  transactionId: z.string().min(8),
  action: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().max(300).optional(),
});

const QUEUE_LIST_KEY = "upi:queue";
const QUEUE_ITEM_PREFIX = "upi:queue:item:";

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

function getUserId(session: unknown): string | null {
  const candidate = session as { user?: { id?: string } };
  return candidate?.user?.id ?? null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  const role = getRole(session);
  const adminId = getUserId(session);
  if (role !== "ADMIN" || !adminId) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid verification payload" }, { status: 400 });
  }

  const transaction = await db.transaction.findUnique({
    where: { id: parsed.data.transactionId },
    include: {
      booking: {
        select: {
          id: true,
          bookingNumber: true,
          guestMobile: true,
        },
      },
    },
  });

  if (!transaction || !transaction.booking) {
    return NextResponse.json({ message: "Transaction not found" }, { status: 404 });
  }
  if (transaction.method !== "MANUAL_UPI") {
    return NextResponse.json({ message: "Transaction is not manual UPI" }, { status: 409 });
  }

  const txMeta = parseTransactionMeta(transaction.notes);

  if (parsed.data.action === "APPROVE") {
    await db.transaction.update({
      where: { id: transaction.id },
      data: {
        status: "PAID",
        verifiedById: adminId,
        verifiedAt: new Date(),
        notes: mergeTransactionMeta(
          [transaction.notes ?? "", "Manual UPI approved by admin"].filter(Boolean).join(" | "),
          { ...(txMeta ?? {}) },
        ),
      },
    });

    const summary = await reconcileBookingPaymentState({
      bookingId: transaction.booking.id,
      incrementCapacityWhenConfirmed: true,
    });

    await redis.lrem(QUEUE_LIST_KEY, 0, transaction.id);
    await redis.del(`${QUEUE_ITEM_PREFIX}${transaction.id}`);

    return NextResponse.json({
      success: true,
      bookingId: transaction.booking.id,
      bookingStatus: summary.status,
      totalPaid: summary.totalPaid,
      balanceDue: summary.balanceDue,
    });
  }

  const rejectReason = parsed.data.reason?.trim();
  if (!rejectReason) {
    return NextResponse.json({ message: "Rejection reason is required" }, { status: 400 });
  }

  await db.transaction.update({
    where: { id: transaction.id },
    data: {
      status: "REJECTED",
      verifiedById: adminId,
      verifiedAt: new Date(),
      notes: mergeTransactionMeta(
        [transaction.notes ?? "", `Manual UPI rejected: ${rejectReason}`].filter(Boolean).join(" | "),
        { ...(txMeta ?? {}) },
      ),
    },
  });

  await redis.lrem(QUEUE_LIST_KEY, 0, transaction.id);
  await redis.del(`${QUEUE_ITEM_PREFIX}${transaction.id}`);

  return NextResponse.json({ success: true });
}
