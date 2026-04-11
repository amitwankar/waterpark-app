import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  mergeTransactionMeta,
  parseTransactionMeta,
  reconcileBookingPaymentState,
} from "@/lib/payment";
import { verifyRazorpayPaymentSignature } from "@/lib/razorpay";

const verifySchema = z.object({
  transactionId: z.string().min(8),
  razorpayOrderId: z.string().min(8),
  razorpayPaymentId: z.string().min(8),
  razorpaySignature: z.string().min(8),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = verifySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid split verification payload" }, { status: 400 });
  }

  const validSignature = verifyRazorpayPaymentSignature({
    orderId: parsed.data.razorpayOrderId,
    paymentId: parsed.data.razorpayPaymentId,
    signature: parsed.data.razorpaySignature,
  });
  if (!validSignature) {
    return NextResponse.json({ message: "Invalid Razorpay signature" }, { status: 400 });
  }

  const transaction = await db.transaction.findUnique({
    where: { id: parsed.data.transactionId },
    include: {
      booking: {
        select: {
          id: true,
          bookingNumber: true,
        },
      },
    },
  });

  if (!transaction || !transaction.booking) {
    return NextResponse.json({ message: "Transaction not found" }, { status: 404 });
  }
  if (transaction.method !== "GATEWAY") {
    return NextResponse.json({ message: "Only gateway split can be signature-verified" }, { status: 400 });
  }
  if (transaction.gatewayRef !== parsed.data.razorpayOrderId) {
    return NextResponse.json({ message: "Order mismatch" }, { status: 400 });
  }

  if (transaction.status !== "PAID") {
    const txMeta = parseTransactionMeta(transaction.notes);
    await db.transaction.update({
      where: { id: transaction.id },
      data: {
        status: "PAID",
        paymentId: parsed.data.razorpayPaymentId,
        notes: mergeTransactionMeta("Gateway split verified", {
          ...(txMeta ?? {}),
        }),
      },
    });
  }

  const summary = await reconcileBookingPaymentState({
    bookingId: transaction.booking.id,
    incrementCapacityWhenConfirmed: true,
  });

  return NextResponse.json({
    success: true,
    bookingId: transaction.booking.id,
    bookingNumber: transaction.booking.bookingNumber,
    totalPaid: summary.totalPaid,
    totalAmount: summary.totalAmount,
    balanceDue: summary.balanceDue,
    bookingStatus: summary.status,
    redirectTo: `/guest/payment/success?bookingId=${transaction.booking.id}`,
  });
}
