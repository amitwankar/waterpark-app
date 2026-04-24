"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useToast } from "@/components/feedback/Toast";
import { fetchJson } from "@/components/settings/http";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export interface QueueSettingsValue {
  queueLimitPerDay: number;
  queuePrefix: string;
  queueVerificationMode: "DISABLED" | "EMAIL" | "SMS" | "BOTH";
}

export interface QueueSettingsProps {
  initialValue: QueueSettingsValue;
  onSaved: (next: Record<string, unknown>) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function QueueSettings({ initialValue, onSaved, onDirtyChange }: QueueSettingsProps): JSX.Element {
  const { pushToast } = useToast();
  const [form, setForm] = useState(initialValue);
  const [saving, startTransition] = useTransition();
  const [resetting, startReset] = useTransition();
  const [testEmail, setTestEmail] = useState("");
  const [testMobile, setTestMobile] = useState("");
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [sendingSmsOtp, setSendingSmsOtp] = useState(false);
  const [testStatus, setTestStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialValue), [form, initialValue]);
  const activeMode = initialValue.queueVerificationMode;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function update<K extends keyof QueueSettingsValue>(key: K, value: QueueSettingsValue[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function getModeBadgeVariant(mode: QueueSettingsValue["queueVerificationMode"]): "warning" | "info" | "success" {
    if (mode === "DISABLED") return "warning";
    if (mode === "BOTH") return "success";
    return "info";
  }

  function getModeLabel(mode: QueueSettingsValue["queueVerificationMode"]): string {
    switch (mode) {
      case "EMAIL":
        return "Email OTP";
      case "SMS":
        return "SMS OTP";
      case "BOTH":
        return "Email + SMS OTP";
      default:
        return "Disabled";
    }
  }

  async function sendTestOtp(channel: "email" | "sms"): Promise<void> {
    setTestStatus(null);
    if (channel === "email") {
      if (!testEmail.trim()) {
        setTestStatus({ type: "error", message: "Enter a test email first." });
        return;
      }
      setSendingEmailOtp(true);
    } else {
      if (!testMobile.trim()) {
        setTestStatus({ type: "error", message: "Enter a test mobile first." });
        return;
      }
      setSendingSmsOtp(true);
    }

    try {
      const response = await fetch("/api/v1/public/queue/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          email: channel === "email" ? testEmail.trim() : undefined,
          mobile: channel === "sms" ? testMobile.trim() : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data?.message === "string" ? data.message : "Failed to send test OTP");
      }
      setTestStatus({
        type: "success",
        message: `Test ${channel.toUpperCase()} OTP sent successfully.`,
      });
    } catch (error: unknown) {
      setTestStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to send test OTP.",
      });
    } finally {
      if (channel === "email") setSendingEmailOtp(false);
      if (channel === "sms") setSendingSmsOtp(false);
    }
  }

  return (
    <section id="queue">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Queue Settings</h2>
            <Badge variant={getModeBadgeVariant(activeMode)}>
              Active public verification: {getModeLabel(activeMode)}
            </Badge>
            {form.queueVerificationMode !== activeMode ? <Badge variant="warning">Unsaved mode change</Badge> : null}
          </div>
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
            <Select
              label="Queue verification mode"
              value={form.queueVerificationMode}
              onChange={(event) => update("queueVerificationMode", event.target.value as QueueSettingsValue["queueVerificationMode"])}
              options={[
                { label: "Disabled", value: "DISABLED" },
                { label: "Email OTP", value: "EMAIL" },
                { label: "SMS OTP", value: "SMS" },
                { label: "Both Email + SMS OTP", value: "BOTH" },
              ]}
            />
          </div>

          <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <p className="text-sm font-medium text-[var(--color-text)]">Test Queue OTP (Admin)</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Sends OTP using the currently active public verification mode.
            </p>

            {form.queueVerificationMode === "DISABLED" ? (
              <p className="text-xs text-amber-700">Public verification is disabled. Enable a mode to test OTP delivery.</p>
            ) : null}

            {form.queueVerificationMode === "EMAIL" || form.queueVerificationMode === "BOTH" ? (
              <div className="grid gap-3 md:grid-cols-[1fr_auto] items-end">
                <Input
                  label="Test email"
                  value={testEmail}
                  onChange={(event) => setTestEmail(event.target.value)}
                  placeholder="name@example.com"
                />
                <Button variant="outline" loading={sendingEmailOtp} onClick={() => void sendTestOtp("email")}>
                  Send Test Email OTP
                </Button>
              </div>
            ) : null}

            {form.queueVerificationMode === "SMS" || form.queueVerificationMode === "BOTH" ? (
              <div className="grid gap-3 md:grid-cols-[1fr_auto] items-end">
                <Input
                  label="Test mobile"
                  value={testMobile}
                  onChange={(event) => setTestMobile(event.target.value)}
                  placeholder="10-digit mobile"
                />
                <Button variant="outline" loading={sendingSmsOtp} onClick={() => void sendTestOtp("sms")}>
                  Send Test SMS OTP
                </Button>
              </div>
            ) : null}

            {testStatus ? (
              <p className={testStatus.type === "success" ? "text-xs text-emerald-700" : "text-xs text-red-600"}>
                {testStatus.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              loading={saving}
              onClick={() => {
                startTransition(() => {
                  void (async () => {
                    try {
                      const next = await fetchJson<Record<string, unknown>>("/api/v1/settings/queue", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(form),
                      });
                      onSaved(next);
                      pushToast({ title: "Queue settings saved", variant: "success" });
                    } catch (error: unknown) {
                      pushToast({
                        title: "Save failed",
                        message: error instanceof Error ? error.message : "Could not save queue settings",
                        variant: "error",
                      });
                    }
                  })();
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
                  void (async () => {
                    try {
                      await fetchJson("/api/v1/settings/queue", { method: "POST" });
                      pushToast({ title: "Queue sequence reset", variant: "success" });
                    } catch (error: unknown) {
                      pushToast({
                        title: "Reset failed",
                        message: error instanceof Error ? error.message : "Could not reset queue",
                        variant: "error",
                      });
                    }
                  })();
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
