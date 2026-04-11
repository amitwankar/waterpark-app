"use client";

import { useState } from "react";
import type { CouponState } from "./useCart";

interface CouponInputProps {
  subtotal: number;
  ticketTypeIds?: string[];
  coupon: CouponState | null;
  onApply: (coupon: CouponState) => void;
  onClear: () => void;
}

export function CouponInput({
  subtotal,
  ticketTypeIds = [],
  coupon,
  onApply,
  onClear,
}: CouponInputProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleValidate() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/pos/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase(), subtotal, ticketTypeIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Validation failed");
      if (!data.valid) {
        setError(data.reason ?? "Invalid coupon");
        return;
      }
      onApply({
        code: data.coupon.code,
        discountAmount: data.coupon.discountAmount,
        description: data.coupon.description ?? null,
      });
      setCode("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  if (coupon) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">{coupon.code}</p>
          {coupon.description && (
            <p className="text-xs text-emerald-600 dark:text-emerald-300">{coupon.description}</p>
          )}
          <p className="mt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-300">
            − ₹{coupon.discountAmount.toFixed(2)} discount
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="ml-3 text-xs font-medium text-emerald-600 hover:text-red-500 dark:text-emerald-300"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
          onKeyDown={(e) => e.key === "Enter" && handleValidate()}
          placeholder="Coupon code"
          disabled={loading}
          className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] uppercase placeholder:normal-case placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          type="button"
          onClick={handleValidate}
          disabled={loading || !code.trim()}
          className="px-3 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          {loading ? "…" : "Apply"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
