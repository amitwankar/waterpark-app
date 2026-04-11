"use client";

import type { CartItem, CouponState, SplitLine } from "./useCart";

interface Totals {
  subtotal: number;
  gstAmount: number;
  discountAmount: number;
  totalAmount: number;
}

interface CartSummaryProps {
  items: CartItem[];
  coupon: CouponState | null;
  splitLines: SplitLine[];
  totals: Totals;
  splitRemaining: number;
  onRemove: (id: string) => void;
  onSetQty: (id: string, qty: number) => void;
  /** Show quantity controls (disabled for read-only receipt view) */
  editable?: boolean;
  /** Extra amount to include in the total (e.g., add-ons) */
  extraAmount?: number;
  /** Extra GST amount (e.g., add-ons GST) */
  extraGstAmount?: number;
  /** Label for extra amount row */
  extraLabel?: string;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  MANUAL_UPI: "UPI",
  CARD: "Card",
  COMPLIMENTARY: "Complimentary",
};

export function CartSummary({
  items,
  coupon,
  splitLines,
  totals,
  splitRemaining,
  onRemove,
  onSetQty,
  editable = true,
  extraAmount = 0,
  extraGstAmount = 0,
  extraLabel = "Add-ons",
}: CartSummaryProps) {
  const isBalanced = Math.abs(splitRemaining) < 0.01;
  const extra = Number.isFinite(extraAmount) ? extraAmount : 0;
  const extraGst = Number.isFinite(extraGstAmount) ? extraGstAmount : 0;
  const displayTotal = Math.round((totals.totalAmount + extra) * 100) / 100;

  return (
    <div className="flex flex-col h-full">
      {/* Items */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {items.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-[var(--color-text-muted)]">
            <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-sm">Cart is empty</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-2 py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-[var(--color-text)]">{item.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  ₹{item.unitPrice.toFixed(2)} × {item.quantity}
                  {item.gstRate > 0 && (
                    <span className="ml-1 text-[var(--color-text-muted)]">+{item.gstRate}% GST</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {editable && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSetQty(item.id, item.quantity - 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-sm leading-none text-[var(--color-text)] hover:bg-[var(--color-surface)]"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-medium text-[var(--color-text)]">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => onSetQty(item.id, item.quantity + 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-sm leading-none text-[var(--color-text)] hover:bg-[var(--color-surface)]"
                    >
                      +
                    </button>
                  </div>
                )}
                <span className="w-20 text-right text-sm font-semibold text-[var(--color-text)]">
                  ₹{(item.unitPrice * item.quantity).toFixed(2)}
                </span>
                {editable && (
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="text-red-400 hover:text-red-600 ml-1"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Totals */}
      {items.length > 0 && (
        <div className="border-t border-gray-200 pt-3 mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Subtotal</span>
            <span>₹{totals.subtotal.toFixed(2)}</span>
          </div>
          {totals.gstAmount > 0 && (
            <div className="flex justify-between text-[var(--color-text-muted)]">
              <span>GST</span>
              <span>₹{totals.gstAmount.toFixed(2)}</span>
            </div>
          )}
          {extraGst > 0 && (
            <div className="flex justify-between text-[var(--color-text-muted)]">
              <span>{extraLabel} GST</span>
              <span>₹{extraGst.toFixed(2)}</span>
            </div>
          )}
          {coupon && totals.discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount ({coupon.code})</span>
              <span>− ₹{totals.discountAmount.toFixed(2)}</span>
            </div>
          )}
          {extra > 0 && (
            <div className="flex justify-between text-[var(--color-text-muted)]">
              <span>{extraLabel}</span>
              <span>₹{extra.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-[var(--color-text)]">
            <span>Total</span>
            <span>₹{displayTotal.toFixed(2)}</span>
          </div>

          {/* Payment lines summary */}
          {splitLines.length > 0 && (
            <div className="mt-2 space-y-1 pt-2 border-t border-dashed border-gray-200">
              {splitLines.map((line, i) => (
                <div key={i} className="flex justify-between text-xs text-[var(--color-text-muted)]">
                  <span>{METHOD_LABELS[line.method] ?? line.method}</span>
                  <span>₹{line.amount.toFixed(2)}</span>
                </div>
              ))}
              <div
                className={`flex justify-between text-xs font-semibold mt-1 ${
                  isBalanced ? "text-green-600" : splitRemaining > 0 ? "text-yellow-600" : "text-red-600"
                }`}
              >
                <span>{isBalanced ? "Fully paid ✓" : "Remaining"}</span>
                {!isBalanced && <span>₹{splitRemaining.toFixed(2)}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
