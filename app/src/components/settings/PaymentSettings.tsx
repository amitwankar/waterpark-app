"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { SensitiveField } from "@/components/settings/SensitiveField";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export interface PaymentSettingsValue {
  razorpayEnabled: boolean;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  manualUpiEnabled: boolean;
  upiId: string;
  upiName: string;
  upiQrImageUrl: string;
  depositEnabled: boolean;
  depositPercent: number;
  depositLabel: string;
  splitEnabled: boolean;
  maxSplitMethods: number;
  minSplitAmount: number;
  refundDeductionPercent: number;
}

export interface PaymentSettingsProps {
  initialValue: PaymentSettingsValue;
  onSaved: (next: Record<string, unknown>) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function PaymentSettings({ initialValue, onSaved, onDirtyChange }: PaymentSettingsProps): JSX.Element {
  const [form, setForm] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialValue), [form, initialValue]);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function update<K extends keyof PaymentSettingsValue>(key: K, value: PaymentSettingsValue[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function updateSecret(field: "razorpayKeyId" | "razorpayKeySecret", value: string): Promise<void> {
    const response = await fetch("/api/v1/settings/secrets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, value }),
    });
    if (!response.ok) return;
    const refresh = await fetch("/api/v1/settings");
    if (!refresh.ok) return;
    const next = await refresh.json();
    onSaved(next);
  }

  return (
    <section id="payment">
      <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Payment Configuration</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <input id="rzp-toggle" type="checkbox" checked={form.razorpayEnabled} onChange={(event) => update("razorpayEnabled", event.target.checked)} />
            <label htmlFor="rzp-toggle" className="text-sm font-medium text-[var(--color-text)]">Enable Razorpay</label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SensitiveField label="Razorpay Key ID" maskedValue={form.razorpayKeyId} onSave={(value) => updateSecret("razorpayKeyId", value)} />
            <SensitiveField label="Razorpay Key Secret" maskedValue={form.razorpayKeySecret} onSave={(value) => updateSecret("razorpayKeySecret", value)} />
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <input id="upi-toggle" type="checkbox" checked={form.manualUpiEnabled} onChange={(event) => update("manualUpiEnabled", event.target.checked)} />
            <label htmlFor="upi-toggle" className="text-sm font-medium text-[var(--color-text)]">Enable Manual UPI</label>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Input label="UPI ID" value={form.upiId} onChange={(event) => update("upiId", event.target.value)} />
            <Input label="UPI Name" value={form.upiName} onChange={(event) => update("upiName", event.target.value)} />
            <Input label="UPI QR URL" value={form.upiQrImageUrl} onChange={(event) => update("upiQrImageUrl", event.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <input id="deposit-toggle" type="checkbox" checked={form.depositEnabled} onChange={(event) => update("depositEnabled", event.target.checked)} />
              <label htmlFor="deposit-toggle" className="text-sm font-medium text-[var(--color-text)]">Enable deposit payments</label>
            </div>
            <Input label="Deposit %" type="number" min={10} max={90} value={String(form.depositPercent)} onChange={(event) => update("depositPercent", Number(event.target.value || 30))} />
            <Input label="Deposit Label" value={form.depositLabel} onChange={(event) => update("depositLabel", event.target.value)} />
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <input id="split-toggle" type="checkbox" checked={form.splitEnabled} onChange={(event) => update("splitEnabled", event.target.checked)} />
              <label htmlFor="split-toggle" className="text-sm font-medium text-[var(--color-text)]">Enable split payment</label>
            </div>
            <Input label="Max split methods" type="number" min={1} max={4} value={String(form.maxSplitMethods)} onChange={(event) => update("maxSplitMethods", Number(event.target.value || 4))} />
            <Input label="Min split amount (Rs)" type="number" min={50} value={String(form.minSplitAmount)} onChange={(event) => update("minSplitAmount", Number(event.target.value || 50))} />
            <Input
              label="Refund Deduction %"
              type="number"
              min={0}
              max={100}
              value={String(form.refundDeductionPercent)}
              onChange={(event) => update("refundDeductionPercent", Number(event.target.value || 0))}
              helper="Applied on cancellation refund amount"
            />
          </div>
        </div>

        <Button
          loading={isPending}
          onClick={() => {
            startTransition(() => {
              void fetch("/api/v1/settings/payment", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpayEnabled: form.razorpayEnabled,
                  manualUpiEnabled: form.manualUpiEnabled,
                  parkUpiId: form.upiId,
                  parkUpiName: form.upiName,
                  parkUpiQrImageUrl: form.upiQrImageUrl,
                  depositEnabled: form.depositEnabled,
                  depositPercent: form.depositPercent,
                  depositLabel: form.depositLabel,
                  splitEnabled: form.splitEnabled,
                  maxSplitMethods: form.maxSplitMethods,
                  minSplitAmount: form.minSplitAmount,
                  refundDeductionPercent: form.refundDeductionPercent,
                }),
              })
                .then((res) => res.json())
                .then((next) => onSaved(next));
            });
          }}
        >
          Save Payment Settings
        </Button>
      </CardBody>
      </Card>
    </section>
  );
}
