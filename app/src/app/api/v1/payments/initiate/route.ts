import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  calculateBalanceDue,
  calculateDepositAmount,
  mergeTransactionMeta,
  resolveDepositConfig,
  type PaymentType,
  type SplitMethod,
} from "@/lib/payment";
import { createRazorpayOrder, getRazorpayKeyId } from "@/lib/razorpay";

const splitSchema = z.object({
  method: z.enum(["GATEWAY", "MANUAL_UPI", "CASH", "WRISTBAND"]),
  amount: z.number().min(50),
});

const initiateSchema = z.object({
  bookingId: z.string().min(8),
  splits: z.array(splitSchema).min(1).max(4),
  paymentType: z.enum(["FULL", "DEPOSIT", "SPLIT"]).optional(),
});

function sumAmounts(splits: Array<{ amount: number }>): number {
  return Math.round(splits.reduce((acc, split) => acc + split.amount, 0) * 100) / 100;
}

function resolvePaymentType(raw: "FULL" | "DEPOSIT" | "SPLIT" | undefined, splitCount: number, hasCash: boolean): PaymentType {
  if (raw) return raw;
  if (splitCount === 1 && !hasCash) return "FULL";
  return "SPLIT";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = initiateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid split payload" }, { status: 400 });
  }

  const booking = await db.booking.findUnique({
    where: { id: parsed.data.bookingId },
    select: {
      id: true,
      bookingNumber: true,
      status: true,
      totalAmount: true,
      guestMobile: true,
    },
  });

  if (!booking) {
    return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  }

  if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
    return NextResponse.json({ message: "Booking is not payable" }, { status: 409 });
  }

  const totalAmount = Number(booking.totalAmount);
  const splits = parsed.data.splits;

  if (splits.some((item) => item.method === "WRISTBAND")) {
    return NextResponse.json({ message: "Wristband is not allowed for initial booking payment" }, { status: 400 });
  }

  const splitTotal = sumAmounts(splits);
  if (splitTotal !== totalAmount) {
    return NextResponse.json(
      { message: `Split total must equal booking total (${totalAmount})` },
      { status: 400 },
    );
  }

  const hasCash = splits.some((item) => item.method === "CASH");
  const paymentType = resolvePaymentType(parsed.data.paymentType, splits.length, hasCash);

  const parkConfig = await db.parkConfig.findFirst();
  const depositConfig = resolveDepositConfig(parkConfig);

  if (paymentType === "DEPOSIT") {
    const depositAmount = calculateDepositAmount(totalAmount, depositConfig.percent);
    const expectedCash = calculateBalanceDue(totalAmount, depositAmount);
    const paidNow = sumAmounts(splits.filter((item) => item.method !== "CASH"));
    if (paidNow !== depositAmount || !splits.some((item) => item.method === "CASH" && item.amount === expectedCash)) {
      return NextResponse.json(
        { message: "Deposit split must include exact deposit now + exact balance as cash at gate" },
        { status: 400 },
      );
    }
  }

  const splitGroup = crypto.randomUUID();

  const createdSplits = await db.$transaction(async (tx: any) => {
    await tx.transaction.updateMany({
      where: {
        bookingId: booking.id,
        status: "PENDING",
      },
      data: {
        notes: "Superseded by new split session",
      },
    });

    const output: Array<{
      transactionId: string;
      method: SplitMethod;
      amount: number;
      razorpayOrderId?: string;
      splitIndex: number;
    }> = [];

    for (let index = 0; index < splits.length; index += 1) {
      const split = splits[index];
      const splitIndex = index + 1;
      const balanceDue = calculateBalanceDue(totalAmount, sumAmounts(splits.slice(0, splitIndex)));

      let gatewayRef: string | null = null;
      if (split.method === "GATEWAY") {
        const order = await createRazorpayOrder({
          amount: split.amount,
          receipt: `${booking.bookingNumber}-${splitIndex}`,
          notes: {
            bookingId: booking.id,
            splitGroup,
            splitIndex: String(splitIndex),
            paymentType,
          },
        });
        gatewayRef = order.id;
      }

      const created = await tx.transaction.create({
        data: {
          bookingId: booking.id,
          amount: split.amount,
          method: split.method,
          status: split.method === "CASH" ? "PENDING" : "PENDING",
          gatewayRef,
          notes: mergeTransactionMeta("Split initiated", {
            paymentType,
            splitGroup,
            splitPortion: split.amount,
            splitIndex,
            isDeposit: paymentType === "DEPOSIT",
            balanceDue,
            bookingId: booking.id,
            bookingNumber: booking.bookingNumber,
          }),
        },
        select: {
          id: true,
          amount: true,
          method: true,
          gatewayRef: true,
        },
      });

      output.push({
        transactionId: created.id,
        method: created.method,
        amount: Number(created.amount),
        razorpayOrderId: created.gatewayRef ?? undefined,
        splitIndex,
      });
    }

    return output;
  });

  return NextResponse.json({
    splitGroup,
    razorpayKeyId: getRazorpayKeyId(),
    paymentType,
    depositPercent: depositConfig.percent,
    splits: createdSplits,
  });
}
