"use client";

import { useState } from "react";
import type { SplitLine } from "./useCart";

export const DEFAULT_METHODS: { value: SplitLine["method"]; label: string; icon: string }[] = [
  { value: "CASH", label: "Cash", icon: "💵" },
  { value: "MANUAL_UPI", label: "UPI", icon: "📱" },
  { value: "CARD", label: "Card", icon: "💳" },
  { value: "COMPLIMENTARY", label: "Complimentary", icon: "🎁" },
];

interface SplitPaymentBuilderProps {
  totalAmount: number;
  splitLines: SplitLine[];
  splitRemaining: number;
  onSet: (lines: SplitLine[]) => void;
  onClear: () => void;
  allowedMethods?: { value: SplitLine["method"]; label: string; icon: string }[];
  minAmount?: number;
  maxMethods?: number;
}

export function SplitPaymentBuilder({
  totalAmount,
  splitLines,
  splitRemaining,
  onSet,
  onClear,
  allowedMethods = DEFAULT_METHODS,
  minAmount = 1,
  maxMethods = 4,
}: SplitPaymentBuilderProps) {
  const [method, setMethod] = useState<SplitLine["method"]>(allowedMethods[0]?.value ?? "CASH");
  const [amount, setAmount] = useState("");

  function addLine() {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < minAmount) return;
    if (splitLines.length >= maxMethods) return;
    const rounded = Math.round(amt * 100) / 100;
    const existingIndex = splitLines.findIndex((line) => line.method === method);
    if (existingIndex >= 0) {
      const next = [...splitLines];
      next[existingIndex] = {
        ...next[existingIndex],
        amount: Math.round((next[existingIndex].amount + rounded) * 100) / 100,
      };
      onSet(next);
    } else {
      onSet([...splitLines, { method, amount: rounded }]);
    }
    setAmount("");
  }

  function removeLine(index: number) {
    onSet(splitLines.filter((_, i) => i !== index));
  }

  function fillRemaining() {
    if (splitRemaining > 0) {
      setAmount(splitRemaining.toFixed(2));
    }
  }

  const isBalanced = Math.abs(splitRemaining) < 0.01;

  return (
    <div className="space-y-3 overflow-x-hidden">
      {/* Existing lines */}
      {splitLines.length > 0 && (
        <div className="space-y-1.5">
          {splitLines.map((line, i) => {
            const m = allowedMethods.find((x) => x.value === line.method);
            return (
              <div key={i} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span>{m?.icon}</span>
                  <span className="font-medium text-[var(--color-text)]">{m?.label}</span>
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-[var(--color-text)]">₹{line.amount.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Balance indicator */}
      {splitLines.length > 0 && (
        <div
          className={`text-xs font-medium px-3 py-1.5 rounded-lg ${
            isBalanced
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
              : splitRemaining > 0
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-300"
              : "bg-red-500/10 text-red-600 dark:text-red-300"
          }`}
        >
          {isBalanced
            ? "✓ Fully paid"
            : splitRemaining > 0
            ? `Remaining: ₹${splitRemaining.toFixed(2)}`
            : `Over by: ₹${Math.abs(splitRemaining).toFixed(2)}`}
        </div>
      )}

      {/* Add line */}
      {!isBalanced && (
        <div className="space-y-2">
          {/* Method selector */}
          <div className="grid grid-cols-4 gap-1.5">
            {allowedMethods.map((m) => (
              <button
                type="button"
                key={m.value}
                onClick={() => setMethod(m.value)}
                className={`flex flex-col items-center py-2 rounded-lg border text-xs font-medium transition-colors ${
                  method === m.value
                    ? "border-teal-500 bg-teal-500/12 text-teal-600 dark:text-teal-300"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-teal-500/50 hover:text-[var(--color-text)]"
                }`}
              >
                <span className="text-lg leading-none mb-1">{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <input
              type="number"
              min={String(minAmount)}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addLine()}
              placeholder="Amount"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <div className="grid grid-cols-2 gap-2">
              {splitRemaining > 0 ? (
                <button
                  type="button"
                  onClick={fillRemaining}
                  className="rounded-lg border border-teal-500/60 px-3 py-2 text-xs font-medium text-teal-600 hover:bg-teal-500/10 dark:text-teal-300"
                >
                  Fill ₹{splitRemaining.toFixed(2)}
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={addLine}
                disabled={!amount || parseFloat(amount) < minAmount || (splitLines.length >= maxMethods && !splitLines.some((line) => line.method === method))}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
              >
                Add payment line
              </button>
            </div>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Min line ₹{minAmount.toFixed(2)} · Max {maxMethods} payment methods
          </p>
        </div>
      )}

      {/* Quick: exact amount if no lines yet */}
      {splitLines.length === 0 && (
        <button
          type="button"
          onClick={() => onSet([{ method: (allowedMethods[0]?.value ?? "CASH"), amount: totalAmount }])}
          className="w-full py-1 text-xs text-[var(--color-text-muted)] hover:text-teal-600 dark:hover:text-teal-300"
        >
          Quick-set: Full amount as {allowedMethods[0]?.label ?? "Cash"}
        </button>
      )}

      {splitLines.length > 0 && (
        <button type="button" onClick={onClear} className="w-full text-xs text-gray-400 hover:text-red-500 py-1">
          Clear all payment lines
        </button>
      )}
    </div>
  );
}
