"use client";

import { useState } from "react";

import { WhatsAppOtpForm } from "@/components/auth/WhatsAppOtpForm";

export default function WhatsAppLoginPage(): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  return (
    <div className="space-y-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <h1 className="text-xl font-semibold">WhatsApp OTP Login</h1>
      <WhatsAppOtpForm
        loading={loading}
        error={error}
        onSend={async (mobile) => {
          setLoading(true);
          setError(undefined);
          try {
            const response = await fetch("/api/auth/whatsapp-otp/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mobile }),
            });
            const json = (await response.json()) as { retryAfterSec?: number; error?: string };
            if (!response.ok) {
              setError(json.error ?? "Failed to send OTP");
            }
            return { retryAfterSec: json.retryAfterSec };
          } finally {
            setLoading(false);
          }
        }}
        onVerify={async (mobile, otp) => {
          setLoading(true);
          setError(undefined);
          try {
            const response = await fetch("/api/auth/whatsapp-otp/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mobile, otp }),
            });

            if (!response.ok) {
              const json = (await response.json()) as { error?: string };
              setError(json.error ?? "OTP verification failed");
              return;
            }

            window.location.href = "/";
          } finally {
            setLoading(false);
          }
        }}
      />
    </div>
  );
}
