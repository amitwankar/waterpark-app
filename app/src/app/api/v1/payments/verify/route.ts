import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  applyDepositToBooking,
  applyFullPaymentToBooking,
  calculateBalanceDue,
  calculateDepositAmount,
  mergeTransactionMeta,
  paymentTypeFromTransactionNotes,
  resolveDepositConfig,
} from "@/lib/payment";
import { verifyRazorpayPaymentSignature } from "@/lib/razorpay";

const verifySchema = z.object({
  bookingId: z.string().min(8),
  razorpayOrderId: z.string().min(8),
  razorpayPaymentId: z.string().min(8),
  razorpaySignature: z.string().min(8),
});

async function sendConfirmationStub(args: {
  mobile: string;
  email?: string | null;
  bookingNumber: string;
  text: string;
}): Promise<void> {
  const message = args.text;
  if (process.env.NODE_ENV !== "production") {
    console.log("[sms:stub]", args.mobile, message);
    if (args.email) {
      console.log("[email:stub]", args.email, message);
    }
    return;
  }

  console.log("[sms:prod-placeholder]", args.mobile, message);
  if (args.email) {
    console.log("[email:prod-placeholder]", args.email, message);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = verifySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payment payload" }, { status: 400 });
  }

  const validSignature = verifyRazorpayPaymentSignature({
    orderId: parsed.data.razorpayOrderId,
    paymentId: parsed.data.razorpayPaymentId,
    signature: parsed.data.razorpaySignature,
  });

  if (!validSignature) {
    return NextResponse.json({ message: "Invalid Razorpay signature" }, { status: 400 });
  }

  const transaction = await db.transaction.findFirst({
    where: {
      bookingId: parsed.data.bookingId,
      method: "GATEWAY",
      gatewayRef: parsed.data.razorpayOrderId,
    },
    select: {
      id: true,
      status: true,
      notes: true,
    },
  });

  if (!transaction) {
    return NextResponse.json({ message: "Transaction not found" }, { status: 404 });
  }

  const booking = await db.booking.findUnique({
    where: { id: parsed.data.bookingId },
    select: {
      id: true,
      bookingNumber: true,
      totalAmount: true,
      guestMobile: true,
      guestEmail: true,
      visitDate: true,
    },
  });
  if (!booking) {
    return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  }

  const paymentType = paymentTypeFromTransactionNotes(transaction.notes);
  const parkConfig = await db.parkConfig.findFirst();
  const depositConfig = resolveDepositConfig(parkConfig);
  const totalAmount = Number(booking.totalAmount);
  const depositAmount = calculateDepositAmount(totalAmount, depositConfig.percent);
  const balanceDue = calculateBalanceDue(totalAmount, depositAmount);

  if (transaction.status !== "PAID") {
    await db.transaction.update({
      where: { id: transaction.id },
      data: {
        status: "PAID",
        paymentId: parsed.data.razorpayPaymentId,
        notes: mergeTransactionMeta("Razorpay payment verified", {
          paymentType,
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          amount: paymentType === "DEPOSIT" ? depositAmount : totalAmount,
          balanceDueAfter: paymentType === "DEPOSIT" ? balanceDue : 0,
        }),
      },
    });
  }

  try {
    if (paymentType === "DEPOSIT") {
      await applyDepositToBooking({
        bookingId: booking.id,
        depositAmount,
        totalAmount,
        depositPercent: depositConfig.percent,
        label: depositConfig.label,
      });

      await sendConfirmationStub({
        mobile: booking.guestMobile,
        email: booking.guestEmail,
        bookingNumber: booking.bookingNumber,
        text: `Booking secured. Pay Rs.${balanceDue} at gate on ${booking.visitDate.toISOString().slice(0, 10)}.`,
      });

      return NextResponse.json({
        success: true,
        paymentType: "DEPOSIT",
        bookingNumber: booking.bookingNumber,
        balanceDue,
        redirectTo: `/guest/payment/success?bookingId=${booking.id}&paymentType=DEPOSIT&balanceDue=${balanceDue}`,
      });
    }

    await applyFullPaymentToBooking({
      bookingId: booking.id,
      incrementCapacityCounter: true,
    });

    await sendConfirmationStub({
      mobile: booking.guestMobile,
      email: booking.guestEmail,
      bookingNumber: booking.bookingNumber,
      text: `Booking ${booking.bookingNumber} confirmed.`,
    });

    return NextResponse.json({
      success: true,
      paymentType: "FULL",
      bookingNumber: booking.bookingNumber,
      redirectTo: `/guest/payment/success?bookingId=${booking.id}&paymentType=FULL`,
    });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 409 });
  }
}
