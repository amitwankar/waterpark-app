"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export interface ParticipantDraft {
  id: string;
  ticketTypeId: string;
  ticketTypeLabel: string;
  name?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  age?: number;
  isLeadGuest?: boolean;
}

export interface ParticipantRowProps {
  participant: ParticipantDraft;
  index: number;
  onChange: (next: ParticipantDraft) => void;
}

export function ParticipantRow({ participant, index, onChange }: ParticipantRowProps): JSX.Element {
  const title = participant.isLeadGuest
    ? `${participant.ticketTypeLabel} ${index + 1} — Lead Guest`
    : `${participant.ticketTypeLabel} ${index + 1}`;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{title}</p>
      <div className="grid gap-3 md:grid-cols-3">
        <Input
          label="Name"
          value={participant.name ?? ""}
          onChange={(event) => onChange({ ...participant, name: event.target.value })}
          placeholder={`Guest ${index + 1}`}
        />

        <Select
          label="Gender"
          value={participant.gender ?? ""}
          onChange={(event) =>
            onChange({
              ...participant,
              gender: (event.target.value || undefined) as "MALE" | "FEMALE" | "OTHER" | undefined,
            })
          }
          options={[
            { label: "Male", value: "MALE" },
            { label: "Female", value: "FEMALE" },
            { label: "Other", value: "OTHER" },
          ]}
          placeholder="Select"
        />

        <Input
          label="Age"
          type="number"
          min={1}
          max={120}
          value={participant.age ?? ""}
          onChange={(event) => {
            const next = event.target.value.trim();
            onChange({ ...participant, age: next ? Number(next) : undefined });
          }}
          placeholder="Age"
        />
      </div>
    </div>
  );
}
