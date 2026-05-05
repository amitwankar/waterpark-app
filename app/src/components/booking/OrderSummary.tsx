"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";

export interface OrderSummaryProps {
  subtotal: number;
  gstAmount: number;
  discountAmount: number;
  totalAmount: number;
  gstRate: number;
  showGstBreakup?: boolean;
  items?: OrderSummaryItem[];
}

export interface OrderSummaryItem {
  label: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export function OrderSummary({
  subtotal,
  gstAmount,
  discountAmount,
  totalAmount,
  gstRate,
  showGstBreakup = true,
  items = [],
}: OrderSummaryProps): JSX.Element {
  const amountBeforeDiscount = subtotal + discountAmount;
  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">Order Summary</h3>
      </CardHeader>
      <CardBody className="space-y-3">
        {items.length > 0 ? (
          <>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={`${item.label}-${index}`} className="space-y-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                  <p className="text-sm font-medium text-[var(--color-text)]">{item.label}</p>
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                    <span>{item.quantity} x {formatCurrency(item.unitPrice)}</span>
                    <span className="font-semibold text-[var(--color-text)]">{formatCurrency(item.lineTotal)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="h-px bg-[var(--color-border)]" />
          </>
        ) : null}
        <SummaryRow label="Amount" value={formatCurrency(amountBeforeDiscount)} />
        <SummaryRow label="Discount" value={`- ${formatCurrency(discountAmount)}`} />
        <SummaryRow label="Subtotal" value={formatCurrency(subtotal)} />
        {showGstBreakup ? <SummaryRow label={`GST (${gstRate}%)`} value={formatCurrency(gstAmount)} /> : null}
        <div className="h-px bg-[var(--color-border)]" />
        <SummaryRow label="Final Total" value={formatCurrency(totalAmount)} highlight />
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
