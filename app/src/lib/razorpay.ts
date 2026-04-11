import crypto from "node:crypto";

import Razorpay from "razorpay";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function getClient(): Razorpay {
  return new Razorpay({
    key_id: requireEnv("RAZORPAY_KEY_ID"),
    key_secret: requireEnv("RAZORPAY_KEY_SECRET"),
  });
}

export function getRazorpayKeyId(): string {
  return requireEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID");
}

export async function createRazorpayOrder(args: {
  amount: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string }> {
  const razorpay = getClient();
  const order = await razorpay.orders.create({
    amount: Math.round(args.amount * 100),
    currency: "INR",
    receipt: args.receipt,
    notes: args.notes,
  });

  return {
    id: order.id,
    amount: Number(order.amount),
    currency: order.currency,
  };
}

export function verifyRazorpayPaymentSignature(args: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const body = `${args.orderId}|${args.paymentId}`;
  const expected = crypto.createHmac("sha256", requireEnv("RAZORPAY_KEY_SECRET")).update(body).digest("hex");
  return expected === args.signature;
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", requireEnv("RAZORPAY_WEBHOOK_SECRET"))
    .update(rawBody)
    .digest("hex");
  return expected === signature;
}
