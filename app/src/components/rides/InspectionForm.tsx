"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";

export interface InspectionFormProps {
  rideId: string;
  onCreated?: () => void;
}

export function InspectionForm({ rideId, onCreated }: InspectionFormProps): JSX.Element {
  const [isPending, startTransition] = useTransition();
  const [checklistPassed, setChecklistPassed] = useState(true);
  const [priority, setPriority] = useState("LOW");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">New Safety Inspection</h3>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input
              type="radio"
              checked={checklistPassed}
              onChange={() => setChecklistPassed(true)}
            />
            Passed
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input
              type="radio"
              checked={!checklistPassed}
              onChange={() => setChecklistPassed(false)}
            />
            Failed
          </label>
        </div>

        <Select
          label="Priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          options={[
            { label: "LOW", value: "LOW" },
            { label: "MEDIUM", value: "MEDIUM" },
            { label: "HIGH", value: "HIGH" },
            { label: "CRITICAL", value: "CRITICAL" },
          ]}
        />

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--color-text)]">Notes</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="h-28 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm outline-none"
            placeholder="Inspection notes, issues, checklist details"
          />
        </div>

        {error ? <p className="text-xs text-red-500">{error}</p> : null}

        <Button
          loading={isPending}
          onClick={() => {
            setError("");
            startTransition(() => {
              void fetch(`/api/v1/rides/${rideId}/inspection`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ checklistPassed, priority, notes }),
              })
                .then(async (response) => {
                  if (!response.ok) {
                    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
                    throw new Error(payload?.message ?? "Failed to create inspection");
                  }
                  setNotes("");
                  setChecklistPassed(true);
                  setPriority("LOW");
                  onCreated?.();
                })
                .catch((nextError: unknown) => {
                  setError(nextError instanceof Error ? nextError.message : "Failed to create inspection");
                });
            });
          }}
        >
          Save Inspection
        </Button>
      </CardBody>
    </Card>
  );
}
