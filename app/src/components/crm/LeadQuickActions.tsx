"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

interface LeadQuickActionsProps {
  leadId: string;
  mobile: string;
}

function defaultFollowUpValue(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function LeadQuickActions({ leadId, mobile }: LeadQuickActionsProps): JSX.Element {
  const router = useRouter();
  const { pushToast } = useToast();

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [followUpAt, setFollowUpAt] = useState(defaultFollowUpValue);
  const [scheduleNote, setScheduleNote] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [markingBooked, setMarkingBooked] = useState(false);
  const [markingLost, setMarkingLost] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const whatsAppLink = useMemo(() => `https://wa.me/91${mobile}`, [mobile]);

  async function scheduleFollowUp(): Promise<void> {
    if (!followUpAt) {
      pushToast({ title: "Select date and time", variant: "warning" });
      return;
    }

    const iso = new Date(followUpAt).toISOString();
    setSavingSchedule(true);
    try {
      const updateRes = await fetch(`/api/v1/crm/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUpAt: iso }),
      });
      if (!updateRes.ok) {
        const payload = (await updateRes.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Unable to schedule follow-up");
      }

      if (scheduleNote.trim().length > 0) {
        await fetch(`/api/v1/crm/leads/${leadId}/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activityType: "NOTE",
            notes: `Follow-up scheduled for ${new Date(iso).toLocaleString("en-IN")}. ${scheduleNote.trim()}`,
          }),
        });
      }

      pushToast({ title: "Follow-up scheduled", variant: "success" });
      setScheduleOpen(false);
      setScheduleNote("");
      router.refresh();
    } catch (error) {
      pushToast({
        title: "Schedule failed",
        message: error instanceof Error ? error.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setSavingSchedule(false);
    }
  }

  async function markAsBooked(): Promise<void> {
    setMarkingBooked(true);
    try {
      const response = await fetch(`/api/v1/crm/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "BOOKED", followUpAt: null }),
      });
      if (!response.ok) throw new Error("Failed to mark lead as booked");
      pushToast({ title: "Lead moved to BOOKED", variant: "success" });
      router.refresh();
    } catch {
      pushToast({ title: "Could not update stage", variant: "error" });
    } finally {
      setMarkingBooked(false);
    }
  }

  async function markAsLost(): Promise<void> {
    const reason = window.prompt("Reason for marking as lost (optional):", "") ?? "";
    setMarkingLost(true);
    try {
      const response = await fetch(`/api/v1/crm/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "LOST", lostReason: reason.trim() || null, followUpAt: null }),
      });
      if (!response.ok) throw new Error("Failed to mark lead as lost");
      pushToast({ title: "Lead moved to LOST", variant: "warning" });
      router.refresh();
    } catch {
      pushToast({ title: "Could not update stage", variant: "error" });
    } finally {
      setMarkingLost(false);
    }
  }

  async function sendMessage(): Promise<void> {
    setSendingMessage(true);
    try {
      await fetch(`/api/v1/crm/leads/${leadId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: "WHATSAPP",
          notes: "WhatsApp conversation initiated from CRM",
        }),
      });
      window.open(whatsAppLink, "_blank", "noopener,noreferrer");
    } finally {
      setSendingMessage(false);
    }
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => setScheduleOpen(true)}>
            Schedule Follow-up
          </Button>
          <Button variant="outline" onClick={() => void sendMessage()} loading={sendingMessage}>
            Send Message
          </Button>
          <Button variant="danger" onClick={() => void markAsLost()} loading={markingLost}>
            Mark as Lost
          </Button>
          <Button onClick={() => void markAsBooked()} loading={markingBooked}>
            Mark as Booked
          </Button>
        </div>
      </div>

      <Modal
        open={scheduleOpen}
        onClose={() => (savingSchedule ? null : setScheduleOpen(false))}
        title="Schedule Follow-up"
        description="Set next follow-up date and optional note."
      >
        <div className="space-y-3">
          <Input
            label="Follow-up date and time"
            type="datetime-local"
            value={followUpAt}
            onChange={(event) => setFollowUpAt(event.target.value)}
          />
          <div className="space-y-1.5">
            <label htmlFor="follow-up-note" className="text-sm font-medium text-[var(--color-text)]">
              Note (optional)
            </label>
            <textarea
              id="follow-up-note"
              value={scheduleNote}
              onChange={(event) => setScheduleNote(event.target.value)}
              rows={3}
              maxLength={500}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              placeholder="Add call context or next action"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setScheduleOpen(false)} disabled={savingSchedule}>
              Cancel
            </Button>
            <Button onClick={() => void scheduleFollowUp()} loading={savingSchedule}>
              Save Follow-up
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
