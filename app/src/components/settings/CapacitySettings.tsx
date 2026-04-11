"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export interface CapacitySettingsValue {
  maxCapacityPerDay: number;
  minDaysAhead: number;
  maxDaysAhead: number;
  bookingCutoffHour: number;
  maxTicketsPerBooking: number;
}

export interface CapacitySettingsProps {
  initialValue: CapacitySettingsValue;
  onSaved: (next: Record<string, unknown>) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function CapacitySettings({ initialValue, onSaved, onDirtyChange }: CapacitySettingsProps): JSX.Element {
  const [form, setForm] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialValue), [form, initialValue]);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function update<K extends keyof CapacitySettingsValue>(key: K, value: CapacitySettingsValue[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <section id="capacity">
      <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Capacity & Booking Rules</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Input label="Max guests per day" type="number" value={String(form.maxCapacityPerDay)} onChange={(event) => update("maxCapacityPerDay", Number(event.target.value || 0))} />
          <Input label="Min days ahead" type="number" value={String(form.minDaysAhead)} onChange={(event) => update("minDaysAhead", Number(event.target.value || 0))} />
          <Input label="Max days ahead" type="number" value={String(form.maxDaysAhead)} onChange={(event) => update("maxDaysAhead", Number(event.target.value || 0))} />
          <Input label="Same-day cutoff hour" type="number" min={0} max={23} value={String(form.bookingCutoffHour)} onChange={(event) => update("bookingCutoffHour", Number(event.target.value || 0))} />
          <Input label="Max tickets per booking" type="number" min={1} value={String(form.maxTicketsPerBooking)} onChange={(event) => update("maxTicketsPerBooking", Number(event.target.value || 1))} />
        </div>

        <Button
          loading={isPending}
          onClick={() => {
            startTransition(() => {
              void fetch("/api/v1/settings/capacity", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
              })
                .then((res) => res.json())
                .then((next) => onSaved(next));
            });
          }}
        >
          Save Capacity Settings
        </Button>
      </CardBody>
      </Card>
    </section>
  );
}
