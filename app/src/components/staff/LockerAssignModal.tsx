"use client";

import { useMemo, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

interface Locker { id: string; number: string; size: string; rate?: number }

interface Props {
  locker: Locker;
  onClose: () => void;
  onAssigned: () => void;
}

export function LockerAssignModal({ locker, onClose, onAssigned }: Props) {
  const [guestName, setGuestName] = useState("");
  const [guestMobile, setGuestMobile] = useState("");
  const [durationType, setDurationType] = useState<"HOURLY" | "FULL_DAY">("HOURLY");
  const [durationHours, setDurationHours] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const computedAmount = useMemo(() => {
    const base = Number(locker.rate ?? 0);
    if (!Number.isFinite(base) || base < 0) return 0;
    if (durationType === "HOURLY") {
      const hours = Math.max(1, Number(durationHours || "1"));
      return Math.round(base * hours * 100) / 100;
    }
    return Math.round(base * 100) / 100;
  }, [durationHours, durationType, locker.rate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) { setError("Guest name is required."); return; }
    if (!/^[6-9]\d{9}$/.test(guestMobile)) { setError("Enter a valid 10-digit mobile number."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/lockers/${locker.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: guestName.trim(),
          guestMobile,
          durationType,
          durationHours: durationType === "HOURLY" ? parseInt(durationHours, 10) : undefined,
          amount: computedAmount,
          paymentMethod,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Failed to assign locker");
        return;
      }
      onAssigned();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={`Assign Locker ${locker.number}`} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <p className="text-sm text-[var(--color-muted)]">Size: {locker.size}</p>
        <p className="text-sm text-[var(--color-muted)]">Configured Rate: ₹{Number(locker.rate ?? 0).toFixed(2)}</p>

        <Input label="Guest Name *" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Full name" />
        <Input label="Mobile *" value={guestMobile} onChange={(e) => setGuestMobile(e.target.value)} placeholder="10-digit mobile" />

        <Select
          value={durationType}
          onChange={(e) => setDurationType(e.target.value as typeof durationType)}
          options={[
            { label: "Hourly", value: "HOURLY" },
            { label: "Full Day", value: "FULL_DAY" },
          ]}
        />
        {durationType === "HOURLY" && (
          <Input
            label="Hours"
            type="number"
            min={1}
            max={12}
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
          />
        )}

        <Input
          label="Amount (₹)"
          type="text"
          value={computedAmount.toFixed(2)}
          readOnly
          helper={durationType === "HOURLY" ? "Auto-calculated as locker rate × hours" : "Auto-calculated from locker configured rate"}
        />

        <Select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          options={[
            { label: "Cash", value: "CASH" },
            { label: "UPI", value: "UPI" },
          ]}
        />

        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Assigning…" : "Assign Locker"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
