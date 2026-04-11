import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { mergeTransactionMeta, parseTransactionMeta, reconcileBookingPaymentState } from "@/lib/payment";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";

type RazorpayEvent = {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
      };
    };
    refund?: {
      entity?: {
        payment_id?: string;
      };
    };
  };
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ message: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  const valid = verifyRazorpayWebhookSignature(rawBody, signature);
  if (!valid) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as RazorpayEvent;
  const payment = event.payload?.payment?.entity;
  const refund = event.payload?.refund?.entity;

  if (event.event === "payment.captured") {
    const orderId = payment?.order_id;
    const paymentId = payment?.id;
    if (orderId) {
      const tx = await db.transaction.findFirst({
        where: { gatewayRef: orderId, method: "GATEWAY" },
        select: {
          id: true,
          bookingId: true,
          status: true,
          notes: true,
        },
      });

      if (tx && tx.status !== "PAID") {
        const txMeta = parseTransactionMeta(tx.notes);
        await db.transaction.update({
          where: { id: tx.id },
          data: {
            status: "PAID",
            paymentId: paymentId ?? undefined,
            notes: mergeTransactionMeta(
              [tx.notes ?? "", "Razorpay webhook: payment captured"].filter(Boolean).join(" | "),
              { ...(txMeta ?? {}) },
            ),
          },
        });

        await reconcileBookingPaymentState({
          bookingId: tx.bookingId,
          incrementCapacityWhenConfirmed: true,
        });
      }
    }
  }

  if (event.event === "payment.failed") {
    const orderId = payment?.order_id;
    if (orderId) {
      await db.transaction.updateMany({
        where: {
          gatewayRef: orderId,
          method: "GATEWAY",
          status: "PENDING",
        },
        data: {
          status: "FAILED",
          notes: "Razorpay webhook: payment failed",
        },
      });
    }
  }

  if (event.event === "refund.created") {
    const paymentId = refund?.payment_id;
    if (paymentId) {
      await db.transaction.updateMany({
        where: { paymentId },
        data: {
          status: "REFUNDED",
          notes: "Razorpay webhook: refund created",
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
