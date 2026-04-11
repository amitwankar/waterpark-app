import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { decrementCapacity } from "@/lib/capacity";
import { db } from "@/lib/db";

const cancelSchema = z.object({
  reason: z.string().trim().min(3, "Reason is required").max(300, "Reason is too long"),
});

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

function getUserId(session: unknown): string | null {
  const candidate = session as { user?: { id?: string } };
  return candidate?.user?.id ?? null;
}

function toMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  const role = getRole(session);
  if (role !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const actorId = getUserId(session);

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.issues[0]?.message ?? "Invalid payload",
      },
      { status: 400 },
    );
  }

  const params = await Promise.resolve(context.params);
  const id = params.id;
  const reason = parsed.data.reason;

  const booking = await db.booking.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      visitDate: true,
      adults: true,
      children: true,
      couponId: true,
      notes: true,
    },
  });

  if (!booking) {
    return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  }

  if (booking.status === "CANCELLED") {
    return NextResponse.json({ message: "Booking already cancelled" }, { status: 409 });
  }
  if (booking.status === "CHECKED_IN" || booking.status === "COMPLETED") {
    return NextResponse.json({ message: "Checked-in or completed bookings cannot be cancelled" }, { status: 409 });
  }

  const result = await db.$transaction(async (tx) => {
    const parkConfig = (await tx.parkConfig.findFirst()) as { refundDeductionPercent?: number | string } | null;
    const refundDeductionPercent = Number(parkConfig?.refundDeductionPercent ?? 0);

    const updated = await tx.booking.update({
      where: { id },
      data: {
        status: "CANCELLED",
        notes: booking.notes ? `${booking.notes}\nCancellation reason: ${reason}` : `Cancellation reason: ${reason}`,
      },
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        notes: true,
      },
    });

    const paidTxns = await tx.transaction.findMany({
      where: {
        bookingId: id,
        status: "PAID",
      },
      select: {
        id: true,
        amount: true,
        notes: true,
      },
    });

    let totalOriginalAmount = 0;
    let totalDeductionAmount = 0;
    let totalRefundAmount = 0;

    for (const paidTxn of paidTxns) {
      const originalAmount = Number(paidTxn.amount);
      const deductionAmount = toMoney((originalAmount * refundDeductionPercent) / 100);
      const refundAmount = toMoney(Math.max(0, originalAmount - deductionAmount));
      totalOriginalAmount += originalAmount;
      totalDeductionAmount += deductionAmount;
      totalRefundAmount += refundAmount;

      await tx.transaction.update({
        where: { id: paidTxn.id },
        data: {
          status: "REFUNDED",
          amount: refundAmount,
          verifiedById: actorId,
          verifiedAt: new Date(),
          notes: paidTxn.notes
            ? `${paidTxn.notes}\nRefunded on booking cancellation (Deduction ${refundDeductionPercent}%: ₹${deductionAmount.toFixed(2)}, Final refund: ₹${refundAmount.toFixed(2)})`
            : `Refunded on booking cancellation (Deduction ${refundDeductionPercent}%: ₹${deductionAmount.toFixed(2)}, Final refund: ₹${refundAmount.toFixed(2)})`,
        },
      });
    }

    if (booking.status === "CONFIRMED") {
      if (booking.couponId) {
        await tx.coupon.updateMany({
          where: { id: booking.couponId, usedCount: { gt: 0 }, currentUses: { gt: 0 } },
          data: { usedCount: { decrement: 1 }, currentUses: { decrement: 1 } },
        });
        await tx.couponRedemption.deleteMany({ where: { couponId: booking.couponId, bookingId: booking.id } });
      }
    }

    return {
      updated,
      refundedCount: paidTxns.length,
      refundDeductionPercent,
      totalOriginalAmount: toMoney(totalOriginalAmount),
      totalDeductionAmount: toMoney(totalDeductionAmount),
      totalRefundAmount: toMoney(totalRefundAmount),
      shouldDecrementCapacity: booking.status === "CONFIRMED",
      pax: booking.adults + booking.children,
      visitDate: booking.visitDate,
    };
  });

  if (result.shouldDecrementCapacity) {
    await decrementCapacity(result.visitDate, result.pax);
  }

  return NextResponse.json({
    booking: result.updated,
    refundedCount: result.refundedCount,
    refund: {
      deductionPercent: result.refundDeductionPercent,
      originalAmount: result.totalOriginalAmount,
      deductionAmount: result.totalDeductionAmount,
      finalRefundAmount: result.totalRefundAmount,
    },
  });
}
