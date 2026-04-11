"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { SensitiveField } from "@/components/settings/SensitiveField";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface NotificationSettingsValue {
  notifyBookingConfirm: boolean;
  notifyCheckin: boolean;
  notifyPaymentReceived: boolean;
  notifyRefund: boolean;
  notifyLoyaltyPoints: boolean;
  whatsappEnabled: boolean;
  whatsappApiKey: string;
  smsEnabled: boolean;
  smsApiKey: string;
}

export interface NotificationSettingsProps {
  initialValue: NotificationSettingsValue;
  onSaved: (next: Record<string, unknown>) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function NotificationSettings({ initialValue, onSaved, onDirtyChange }: NotificationSettingsProps): JSX.Element {
  const [form, setForm] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialValue), [form, initialValue]);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function update<K extends keyof NotificationSettingsValue>(key: K, value: NotificationSettingsValue[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function updateSecret(field: "whatsappApiKey" | "smsApiKey", value: string): Promise<void> {
    const payload = { ...form, [field]: value };
    const response = await fetch("/api/v1/settings/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const next = await response.json();
    onSaved(next);
  }

  return (
    <section id="notifications">
      <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Notification & Alert Settings</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["notifyBookingConfirm", "Booking confirmation"],
            ["notifyCheckin", "Check-in updates"],
            ["notifyPaymentReceived", "Payment received"],
            ["notifyRefund", "Refund updates"],
            ["notifyLoyaltyPoints", "Loyalty points updates"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form[key as keyof NotificationSettingsValue])}
                onChange={(event) => update(key as keyof NotificationSettingsValue, event.target.checked as never)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.whatsappEnabled} onChange={(event) => update("whatsappEnabled", event.target.checked)} />
              <span>Enable WhatsApp</span>
            </label>
            <SensitiveField label="WhatsApp API Key" maskedValue={form.whatsappApiKey} onSave={(value) => updateSecret("whatsappApiKey", value)} />
          </div>

          <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.smsEnabled} onChange={(event) => update("smsEnabled", event.target.checked)} />
              <span>Enable SMS</span>
            </label>
            <SensitiveField label="SMS API Key" maskedValue={form.smsApiKey} onSave={(value) => updateSecret("smsApiKey", value)} />
          </div>
        </div>

        <Button
          loading={isPending}
          onClick={() => {
            startTransition(() => {
              void fetch("/api/v1/settings/notifications", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
              })
                .then((res) => res.json())
                .then((next) => onSaved(next));
            });
          }}
        >
          Save Notification Settings
        </Button>
      </CardBody>
      </Card>
    </section>
  );
}
