"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export type PaymentChoice = "FULL" | "DEPOSIT";

export interface PaymentMethodSelectorProps {
  totalAmount: number;
  depositAmount: number;
  balanceDue: number;
  depositPercent: number;
  depositLabel: string;
  value: PaymentChoice;
  onChange: (value: PaymentChoice) => void;
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function PaymentMethodSelector({
  totalAmount,
  depositAmount,
  balanceDue,
  depositPercent,
  depositLabel,
  value,
  onChange,
}: PaymentMethodSelectorProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <button type="button" className="text-left" onClick={() => onChange("FULL")}>
        <Card
          className={cn(
            "transition-all duration-150",
            value === "FULL"
              ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20"
              : "hover:border-[var(--color-primary)]/50",
          )}
        >
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-base font-semibold text-[var(--color-text)]">Pay Full Amount</p>
              <Badge variant="success">Recommended</Badge>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text)]">{formatInr(totalAmount)}</p>
            <p className="text-sm text-[var(--color-text-muted)]">Instant confirmation and fastest gate entry.</p>
          </CardBody>
        </Card>
      </button>

      <button type="button" className="text-left" onClick={() => onChange("DEPOSIT")}>
        <Card
          className={cn(
            "transition-all duration-150",
            value === "DEPOSIT"
              ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20"
              : "hover:border-[var(--color-primary)]/50",
          )}
        >
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-base font-semibold text-[var(--color-text)]">Pre-Book with Deposit</p>
              <Badge variant="warning">{depositPercent}% now</Badge>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text)]">{formatInr(depositAmount)}</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {depositLabel}. Pay remaining <span className="font-semibold text-[var(--color-text)]">{formatInr(balanceDue)}</span> at gate.
            </p>
          </CardBody>
        </Card>
      </button>
    </div>
  );
}
