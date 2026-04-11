"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";

interface RazorpayCheckoutResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

export interface RazorpayButtonProps {
  transactionId: string;
  orderId: string;
  keyId: string;
  amount: number;
  bookingName: string;
  bookingMobile: string;
  bookingEmail?: string | null;
  disabled?: boolean;
  onVerified: (data: {
    transactionId: string;
    bookingStatus: string;
    totalPaid: number;
    balanceDue: number;
  }) => void;
}

async function ensureRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Razorpay is only available in browser");
  }

  const existing = document.querySelector<HTMLScriptElement>("script[data-razorpay='1']");
  if (existing) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpay = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.body.appendChild(script);
  });
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function RazorpayButton({
  transactionId,
  orderId,
  keyId,
  amount,
  bookingName,
  bookingMobile,
  bookingEmail,
  disabled,
  onVerified,
}: RazorpayButtonProps): JSX.Element {
  const [loading, setLoading] = useState(false);

  async function startCheckout(): Promise<void> {
    try {
      setLoading(true);
      await ensureRazorpayScript();

      const options: Record<string, unknown> = {
        key: keyId,
        order_id: orderId,
        amount: Math.round(amount * 100),
        currency: "INR",
        name: "AquaWorld Park",
        description: "Split Payment",
        prefill: {
          name: bookingName,
          contact: bookingMobile,
          email: bookingEmail ?? undefined,
        },
        theme: {
          color: "#0f766e",
        },
        handler: async (response: RazorpayCheckoutResponse) => {
          const verifyResponse = await fetch("/api/v1/payments/verify-split", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transactionId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });
          const verifyPayload = (await verifyResponse.json().catch(() => null)) as {
            message?: string;
            bookingStatus: string;
            totalPaid: number;
            balanceDue: number;
          } | null;

          if (!verifyResponse.ok || !verifyPayload) {
            throw new Error(verifyPayload?.message ?? "Verification failed");
          }

          onVerified({
            transactionId,
            bookingStatus: verifyPayload.bookingStatus,
            totalPaid: verifyPayload.totalPaid,
            balanceDue: verifyPayload.balanceDue,
          });
          setLoading(false);
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      };

      const instance = new window.Razorpay(options);
      instance.open();
    } catch (error) {
      setLoading(false);
      window.alert((error as Error).message);
    }
  }

  return (
    <Button className="w-full" disabled={disabled} loading={loading} onClick={() => void startCheckout()}>
      Pay {formatInr(amount)} via Razorpay
    </Button>
  );
}
