"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export interface GeneralSettingsValue {
  parkName: string;
  logoUrl: string;
  phone: string;
  email: string;
  websiteUrl: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  timezone: string;
}

export interface GeneralSettingsProps {
  initialValue: GeneralSettingsValue;
  onSaved: (next: Record<string, unknown>) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function GeneralSettings({ initialValue, onSaved, onDirtyChange }: GeneralSettingsProps): JSX.Element {
  const [form, setForm] = useState<GeneralSettingsValue>(initialValue);
  const [isPending, startTransition] = useTransition();

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialValue), [form, initialValue]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function update<K extends keyof GeneralSettingsValue>(key: K, value: GeneralSettingsValue[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <section id="general">
      <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">General Settings</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Park Name" value={form.parkName} onChange={(event) => update("parkName", event.target.value)} />
          <Input label="Logo URL" value={form.logoUrl} onChange={(event) => update("logoUrl", event.target.value)} />
          <Input label="Contact Phone" value={form.phone} onChange={(event) => update("phone", event.target.value)} />
          <Input label="Contact Email" value={form.email} onChange={(event) => update("email", event.target.value)} />
          <Input label="Website" value={form.websiteUrl} onChange={(event) => update("websiteUrl", event.target.value)} />
          <Input label="Timezone" value={form.timezone} onChange={(event) => update("timezone", event.target.value)} />
        </div>

        <Input label="Address" value={form.address} onChange={(event) => update("address", event.target.value)} />

        <div className="grid gap-4 md:grid-cols-3">
          <Input label="City" value={form.city} onChange={(event) => update("city", event.target.value)} />
          <Input label="State" value={form.state} onChange={(event) => update("state", event.target.value)} />
          <Input label="Pincode" value={form.pincode} onChange={(event) => update("pincode", event.target.value)} />
        </div>

        <Button
          loading={isPending}
          onClick={() => {
            startTransition(() => {
              void fetch("/api/v1/settings/general", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  parkName: form.parkName,
                  logoUrl: form.logoUrl || null,
                  phone: form.phone || null,
                  email: form.email || null,
                  websiteUrl: form.websiteUrl || null,
                  address: form.address || null,
                  city: form.city || null,
                  state: form.state || null,
                  pincode: form.pincode || null,
                  timezone: form.timezone,
                }),
              })
                .then((res) => res.json())
                .then((next) => onSaved(next));
            });
          }}
        >
          Save General Settings
        </Button>
      </CardBody>
      </Card>
    </section>
  );
}
