"use client";

import { useState } from "react";

import { ParticipantRow, type ParticipantDraft } from "@/components/booking/ParticipantRow";
import { Button } from "@/components/ui/Button";

export interface ParticipantFillFormProps {
  bookingId: string;
  participants: ParticipantDraft[];
  onSaved?: () => void;
}

export function ParticipantFillForm({ bookingId, participants, onSaved }: ParticipantFillFormProps): JSX.Element {
  const [rows, setRows] = useState<ParticipantDraft[]>(participants);
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="text-sm font-semibold text-[var(--color-text)]">Collect Guest Details</h3>
      <p className="text-xs text-[var(--color-text-muted)]">Fill missing participant names before check-in. You can also skip and mark pending.</p>

      <div className="space-y-3">
        {rows.map((participant, index) => (
          <ParticipantRow
            key={participant.id}
            participant={participant}
            index={index}
            onChange={(next) => {
              const updated = [...rows];
              updated[index] = next;
              setRows(updated);
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          loading={loading}
          onClick={async () => {
            setLoading(true);
            try {
              await fetch(`/api/v1/bookings/${bookingId}/participants`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  participants: rows.map((row) => ({
                    id: row.id,
                    name: row.name,
                    gender: row.gender ?? null,
                    age: row.age ?? null,
                    isLeadGuest: row.isLeadGuest,
                  })),
                }),
              });
              onSaved?.();
            } finally {
              setLoading(false);
            }
          }}
        >
          Save Details
        </Button>

        <Button
          variant="outline"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              await fetch(`/api/v1/bookings/${bookingId}/participants`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  participants: rows.map((row) => ({
                    id: row.id,
                    name: row.name,
                    gender: row.gender ?? null,
                    age: row.age ?? null,
                    isLeadGuest: row.isLeadGuest,
                  })),
                  walkInDetailsPending: true,
                }),
              });
              onSaved?.();
            } finally {
              setLoading(false);
            }
          }}
        >
          Skip
        </Button>
      </div>
    </div>
  );
}
