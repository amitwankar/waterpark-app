"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export interface ManualUpiFormProps {
  transactionId: string;
  amount: number;
  paymentType: "FULL" | "DEPOSIT" | "SPLIT";
  disabled?: boolean;
  onSubmitted: (data: { transactionId: string }) => void;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read screenshot"));
    reader.readAsDataURL(file);
  });
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ManualUpiForm({ transactionId, amount, paymentType, disabled, onSubmitted }: ManualUpiFormProps): JSX.Element {
  const [upiRef, setUpiRef] = useState("");
  const [screenshot, setScreenshot] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitManualUpi(): Promise<void> {
    if (upiRef.trim().length < 6) {
      setError("Enter a valid UPI reference");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/v1/payments/manual-upi/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId,
          upiRef,
          screenshot: screenshot || undefined,
          paymentType,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "Failed to submit UPI proof");
      }

      onSubmitted({ transactionId });
      setLoading(false);
    } catch (submitError) {
      setError((submitError as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
      <p className="text-sm font-medium text-[var(--color-text)]">Manual UPI Portion: {formatInr(amount)}</p>

      <Input
        label="UPI Reference"
        placeholder="Enter UTR / UPI reference"
        value={upiRef}
        onChange={(event) => setUpiRef(event.target.value.toUpperCase())}
        error={error}
      />

      <div className="space-y-1">
        <label className="text-sm font-medium text-[var(--color-text)]">Screenshot (Optional)</label>
        <input
          type="file"
          accept="image/*"
          className="block w-full text-sm text-[var(--color-text-muted)] file:mr-3 file:rounded-[var(--radius-sm)] file:border file:border-[var(--color-border)] file:bg-[var(--color-surface)] file:px-2 file:py-1 file:text-xs"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const dataUrl = await fileToDataUrl(file);
            setScreenshot(dataUrl);
          }}
        />
      </div>

      <Button className="w-full" disabled={disabled} loading={loading} onClick={() => void submitManualUpi()}>
        Submit UPI Proof
      </Button>
    </div>
  );
}
