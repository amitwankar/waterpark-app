"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Locker {
  id: string;
  number: string;
  assignments: Array<{ id: string; guestName: string; guestMobile: string; dueAt: string }>;
}

interface Props {
  locker: Locker;
  onClose: () => void;
  onReleased: () => void;
}

export function LockerReleaseModal({ locker, onClose, onReleased }: Props) {
  const assignment = locker.assignments[0];
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!assignment) {
    return (
      <Modal open title={`Release Locker ${locker.number}`} onClose={onClose}>
        <p className="text-sm text-[var(--color-muted)]">No active assignment found.</p>
        <Button variant="outline" onClick={onClose} className="mt-4">Close</Button>
      </Modal>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/lockers/${locker.id}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: assignment.id, notes: notes.trim() || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Failed to release locker");
        return;
      }
      onReleased();
    } finally {
      setSaving(false);
    }
  }

  const dueAt = new Date(assignment.dueAt);
  const isOverdue = dueAt < new Date();

  return (
    <Modal open title={`Release Locker ${locker.number}`} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div className="rounded-[var(--radius-input)] bg-[var(--color-border)] p-3 text-sm space-y-1">
          <p><span className="font-medium">Guest:</span> {assignment.guestName}</p>
          <p><span className="font-medium">Mobile:</span> {assignment.guestMobile}</p>
          <p className={isOverdue ? "text-red-500 font-medium" : ""}>
            <span className="font-medium text-[var(--color-text)]">Due:</span>{" "}
            {dueAt.toLocaleString("en-IN")}
            {isOverdue && " — OVERDUE"}
          </p>
        </div>

        <Input
          label="Return Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any damage, comments…"
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Releasing…" : "Confirm Release"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
