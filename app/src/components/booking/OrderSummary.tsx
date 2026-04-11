"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";

export interface OrderSummaryProps {
  subtotal: number;
  gstAmount: number;
  discountAmount: number;
  totalAmount: number;
  gstRate: number;
}

export function OrderSummary({
  subtotal,
  gstAmount,
  discountAmount,
  totalAmount,
  gstRate,
}: OrderSummaryProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">Order Summary</h3>
      </CardHeader>
      <CardBody className="space-y-3">
        <SummaryRow label="Subtotal" value={formatCurrency(subtotal)} />
        <SummaryRow label={`GST (${gstRate}%)`} value={formatCurrency(gstAmount)} />
        <SummaryRow label="Discount" value={`- ${formatCurrency(discountAmount)}`} />
        <div className="h-px bg-[var(--color-border)]" />
        <SummaryRow label="Total" value={formatCurrency(totalAmount)} highlight />
      </CardBody>
    </Card>
  );
}

interface SummaryRowProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function SummaryRow({ label, value, highlight }: SummaryRowProps): JSX.Element {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={highlight ? "font-semibold text-[var(--color-text)]" : "text-[var(--color-text-muted)]"}>{label}</span>
      <span className={highlight ? "text-base font-semibold text-[var(--color-text)]" : "font-medium text-[var(--color-text)]"}>{value}</span>
    </div>
  );
}

