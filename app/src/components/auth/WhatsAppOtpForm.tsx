"use client";

import { useState } from "react";

import { OtpInputGrid } from "@/components/auth/OtpInputGrid";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface WhatsAppOtpFormProps {
  onSend: (mobile: string, captchaToken?: string) => Promise<{ retryAfterSec?: number } | void>;
  onVerify: (mobile: string, otp: string) => Promise<void>;
  loading?: boolean;
  error?: string;
}

export function WhatsAppOtpForm({ onSend, onVerify, loading, error }: WhatsAppOtpFormProps): JSX.Element {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <Input
        label="Mobile"
        value={mobile}
        onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))}
        placeholder="10-digit mobile"
      />

      {sent ? <OtpInputGrid value={otp} onChange={setOtp} disabled={loading} /> : null}

      {retryAfter ? <p className="text-xs text-amber-600">Try again in {retryAfter}s</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      {!sent ? (
        <Button
          className="w-full"
          loading={loading}
          onClick={async () => {
            const result = await onSend(mobile);
            setSent(true);
            setRetryAfter(result?.retryAfterSec ?? null);
          }}
        >
          Send WhatsApp OTP
        </Button>
      ) : (
        <Button
          className="w-full"
          loading={loading}
          onClick={async () => {
            await onVerify(mobile, otp);
          }}
        >
          Verify OTP
        </Button>
      )}
    </div>
  );
}
