"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export interface PricingSettingsValue {
  defaultGstRate: number;
  foodGstRate: number;
  lockerGstRate: number;
  gstNumber: string;
  invoicePrefix: string;
  invoiceStartNumber: number;
  loyaltyEnabled: boolean;
  pointsPerRupee: number;
  pointRedeemValue: number;
  maxRedeemPercent: number;
  pointsExpiryDays: number;
}

export interface PricingSettingsProps {
  initialValue: PricingSettingsValue;
  onSaved: (next: Record<string, unknown>) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function PricingSettings({ initialValue, onSaved, onDirtyChange }: PricingSettingsProps): JSX.Element {
  const [form, setForm] = useState<PricingSettingsValue>(initialValue);
  const [isPending, startTransition] = useTransition();

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialValue), [form, initialValue]);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function update<K extends keyof PricingSettingsValue>(key: K, value: PricingSettingsValue[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <section id="pricing">
      <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Pricing & Tax</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="Default GST %" type="number" value={String(form.defaultGstRate)} onChange={(event) => update("defaultGstRate", Number(event.target.value || 0))} />
          <Input label="Food GST %" type="number" value={String(form.foodGstRate)} onChange={(event) => update("foodGstRate", Number(event.target.value || 0))} />
          <Input label="Locker GST %" type="number" value={String(form.lockerGstRate)} onChange={(event) => update("lockerGstRate", Number(event.target.value || 0))} />
          <Input label="GSTIN" value={form.gstNumber} onChange={(event) => update("gstNumber", event.target.value.toUpperCase())} />
          <Input label="Invoice Prefix" value={form.invoicePrefix} onChange={(event) => update("invoicePrefix", event.target.value)} />
          <Input label="Invoice Start Number" type="number" value={String(form.invoiceStartNumber)} onChange={(event) => update("invoiceStartNumber", Number(event.target.value || 1))} />
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <input id="loyaltyEnabled" type="checkbox" checked={form.loyaltyEnabled} onChange={(event) => update("loyaltyEnabled", event.target.checked)} />
            <label htmlFor="loyaltyEnabled" className="text-sm font-medium text-[var(--color-text)]">Enable loyalty program</label>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input label="Points / Rs" type="number" value={String(form.pointsPerRupee)} onChange={(event) => update("pointsPerRupee", Number(event.target.value || 0))} />
            <Input label="Point value (Rs)" type="number" value={String(form.pointRedeemValue)} onChange={(event) => update("pointRedeemValue", Number(event.target.value || 0))} />
            <Input label="Max redeem %" type="number" value={String(form.maxRedeemPercent)} onChange={(event) => update("maxRedeemPercent", Number(event.target.value || 0))} />
            <Input label="Points expiry days" type="number" value={String(form.pointsExpiryDays)} onChange={(event) => update("pointsExpiryDays", Number(event.target.value || 365))} />
          </div>
        </div>

        <Button
          loading={isPending}
          onClick={() => {
            startTransition(() => {
              void fetch("/api/v1/settings/pricing", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
              })
                .then((res) => res.json())
                .then((next) => onSaved(next));
            });
          }}
        >
          Save Pricing Settings
        </Button>
      </CardBody>
      </Card>
    </section>
  );
}
