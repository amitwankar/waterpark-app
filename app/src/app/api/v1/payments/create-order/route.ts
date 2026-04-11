import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  calculateBalanceDue,
  calculateDepositAmount,
  mergeTransactionMeta,
  resolveDepositConfig,
  type PaymentType,
} from "@/lib/payment";
import { createRazorpayOrder, getRazorpayKeyId } from "@/lib/razorpay";

const createOrderSchema = z.object({
  bookingId: z.string().min(8),
  paymentType: z.enum(["FULL", "DEPOSIT"]).default("FULL"),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid booking id" }, { status: 400 });
  }

  const booking = await db.booking.findUnique({
    where: { id: parsed.data.bookingId },
    select: {
      id: true,
      bookingNumber: true,
      status: true,
      totalAmount: true,
      guestName: true,
      guestMobile: true,
    },
  });

  if (!booking) {
    return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  }

  if (booking.status !== "PENDING") {
    return NextResponse.json({ message: "Booking is not pending payment" }, { status: 409 });
  }

  const totalAmount = Number(booking.totalAmount);
  if (totalAmount <= 0) {
    return NextResponse.json({ message: "Invalid booking amount for online payment" }, { status: 400 });
  }

  const parkConfig = await db.parkConfig.findFirst();
  const depositConfig = resolveDepositConfig(parkConfig);
  const paymentType = parsed.data.paymentType as PaymentType;
  if (paymentType === "DEPOSIT" && !depositConfig.enabled) {
    return NextResponse.json({ message: "Deposit payment is disabled" }, { status: 400 });
  }

  const depositAmount = calculateDepositAmount(totalAmount, depositConfig.percent);
  const payableAmount = paymentType === "DEPOSIT" ? depositAmount : totalAmount;
  const balanceDueAfter = paymentType === "DEPOSIT" ? calculateBalanceDue(totalAmount, depositAmount) : 0;

  const order = await createRazorpayOrder({
    amount: payableAmount,
    receipt: booking.bookingNumber,
    notes: {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      guestMobile: booking.guestMobile,
      paymentType,
    },
  });

  const existingPending = await db.transaction.findFirst({
    where: {
      bookingId: booking.id,
      method: "GATEWAY",
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  let transactionId: string;
  if (existingPending) {
    const updated = await db.transaction.update({
      where: { id: existingPending.id },
      data: {
        gatewayRef: order.id,
        amount: payableAmount,
        notes: mergeTransactionMeta("Razorpay order created", {
          paymentType,
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          amount: payableAmount,
          balanceDueAfter,
        }),
      },
      select: { id: true },
    });
    transactionId = updated.id;
  } else {
    const created = await db.transaction.create({
      data: {
        bookingId: booking.id,
        amount: payableAmount,
        method: "GATEWAY",
        status: "PENDING",
        gatewayRef: order.id,
        notes: mergeTransactionMeta("Razorpay order created", {
          paymentType,
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          amount: payableAmount,
          balanceDueAfter,
        }),
      },
      select: { id: true },
    });
    transactionId = created.id;
  }

  return NextResponse.json({
    keyId: getRazorpayKeyId(),
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    transactionId,
    paymentType,
    totalAmount,
    depositAmount,
    balanceDueAfter,
    depositPercent: depositConfig.percent,
    depositLabel: depositConfig.label,
    prefill: {
      name: booking.guestName,
      contact: booking.guestMobile,
    },
  });
}
