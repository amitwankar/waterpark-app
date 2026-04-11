"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";

interface LeadNotesEditorProps {
  leadId: string;
  initialNotes: string;
}

export function LeadNotesEditor({ leadId, initialNotes }: LeadNotesEditorProps): JSX.Element {
  const router = useRouter();
  const { pushToast } = useToast();
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  async function saveNotes(): Promise<void> {
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/crm/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to save notes");
      }

      await fetch(`/api/v1/crm/leads/${leadId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: "NOTE",
          notes: "Lead notes updated",
        }),
      });

      pushToast({ title: "Notes saved", variant: "success" });
      router.refresh();
    } catch (error) {
      pushToast({
        title: "Unable to save notes",
        message: error instanceof Error ? error.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={12}
        maxLength={3000}
        className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
        placeholder="Add complete lead notes, pain points, requirements, and next steps."
      />
      <div className="flex justify-end">
        <Button onClick={() => void saveNotes()} loading={saving}>
          Save Notes
        </Button>
      </div>
    </div>
  );
}

