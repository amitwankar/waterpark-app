"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export interface QueueSettingsValue {
  queueLimitPerDay: number;
  queuePrefix: string;
}

export interface QueueSettingsProps {
  initialValue: QueueSettingsValue;
  onSaved: (next: Record<string, unknown>) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function QueueSettings({ initialValue, onSaved, onDirtyChange }: QueueSettingsProps): JSX.Element {
  const [form, setForm] = useState(initialValue);
  const [saving, startTransition] = useTransition();
  const [resetting, startReset] = useTransition();

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialValue), [form, initialValue]);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function update<K extends keyof QueueSettingsValue>(key: K, value: QueueSettingsValue[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <section id="queue">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Queue Settings</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Public queue captures selections without payment. Ticket POS imports by queue ID and collects payment.
          </p>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Queue limit per day (0 = unlimited)"
              type="number"
              min={0}
              value={String(form.queueLimitPerDay)}
              onChange={(event) => update("queueLimitPerDay", Number(event.target.value || 0))}
            />
            <Input
              label="Queue prefix"
              value={form.queuePrefix}
              onChange={(event) => update("queuePrefix", event.target.value)}
              placeholder="Q"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              loading={saving}
              onClick={() => {
                startTransition(() => {
                  void fetch("/api/v1/settings/queue", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(form),
                  })
                    .then((res) => res.json())
                    .then((next) => onSaved(next));
                });
              }}
            >
              Save Queue Settings
            </Button>

            <Button
              variant="outline"
              loading={resetting}
              onClick={() => {
                if (!confirm("Reset queue sequence now? This starts a new queue series for today.")) return;
                startReset(() => {
                  void fetch("/api/v1/settings/queue", { method: "POST" })
                    .then((res) => res.json())
                    .then(() => onSaved({}));
                });
              }}
            >
              Reset Queue
            </Button>
          </div>
        </CardBody>
      </Card>
    </section>
  );
}

