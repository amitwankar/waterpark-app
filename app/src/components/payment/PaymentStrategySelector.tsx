"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export type PaymentStrategy = "FULL" | "DEPOSIT" | "SPLIT";

export interface PaymentStrategySelectorProps {
  totalAmount: number;
  depositAmount: number;
  balanceAfterDeposit: number;
  depositPercent: number;
  depositLabel: string;
  value: PaymentStrategy;
  onChange: (strategy: PaymentStrategy) => void;
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function OptionCard(props: {
  title: string;
  subtitle: string;
  amountLine: string;
  active: boolean;
  badge?: { label: string; variant: "default" | "success" | "warning" | "info" };
  onClick: () => void;
}): JSX.Element {
  return (
    <button type="button" className="text-left" onClick={props.onClick}>
      <Card
        className={cn(
          "h-full transition-all duration-150",
          props.active
            ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20"
            : "hover:border-[var(--color-primary)]/50",
        )}
      >
        <CardBody className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-base font-semibold text-[var(--color-text)]">{props.title}</p>
            {props.badge ? <Badge variant={props.badge.variant}>{props.badge.label}</Badge> : null}
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">{props.subtitle}</p>
          <p className="text-lg font-bold text-[var(--color-text)]">{props.amountLine}</p>
        </CardBody>
      </Card>
    </button>
  );
}

export function PaymentStrategySelector({
  totalAmount,
  depositAmount,
  balanceAfterDeposit,
  depositPercent,
  depositLabel,
  value,
  onChange,
}: PaymentStrategySelectorProps): JSX.Element {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <OptionCard
        title="Pay Full Now"
        subtitle="Single method, full amount now."
        amountLine={formatInr(totalAmount)}
        badge={{ label: "Fastest", variant: "success" }}
        active={value === "FULL"}
        onClick={() => onChange("FULL")}
      />

      <OptionCard
        title="Pre-Booking Deposit"
        subtitle={depositLabel}
        amountLine={`${formatInr(depositAmount)} now + ${formatInr(balanceAfterDeposit)} at gate`}
        badge={{ label: `${depositPercent}%`, variant: "warning" }}
        active={value === "DEPOSIT"}
        onClick={() => onChange("DEPOSIT")}
      />

      <OptionCard
        title="Custom Split"
        subtitle="Split across multiple methods."
        amountLine={`Allocate up to 4 portions of ${formatInr(totalAmount)}`}
        badge={{ label: "Flexible", variant: "info" }}
        active={value === "SPLIT"}
        onClick={() => onChange("SPLIT")}
      />
    </div>
  );
}
