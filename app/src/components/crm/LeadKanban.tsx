"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useOptimistic, useState, useTransition } from "react";

import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { LeadCard, type LeadCardData } from "@/components/crm/LeadCard";

export type PipelineStage = "NEW" | "CONTACTED" | "INTERESTED" | "PROPOSAL_SENT" | "BOOKED" | "LOST";

export interface LeadKanbanItem extends LeadCardData {
  stage: PipelineStage;
}

export interface LeadKanbanProps {
  leads: LeadKanbanItem[];
}

const COLUMNS: PipelineStage[] = ["NEW", "CONTACTED", "INTERESTED", "PROPOSAL_SENT", "BOOKED", "LOST"];

export function LeadKanban({ leads }: LeadKanbanProps): JSX.Element {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { pushToast } = useToast();
  const [scheduleLeadId, setScheduleLeadId] = useState<string | null>(null);
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [optimisticLeads, updateOptimistic] = useOptimistic(
    leads,
    (state, action: { leadId: string; stage: PipelineStage }) =>
      state.map((lead) => (lead.id === action.leadId ? { ...lead, stage: action.stage } : lead)),
  );

  const grouped = useMemo(() => {
    const map = new Map<PipelineStage, LeadKanbanItem[]>();
    for (const stage of COLUMNS) map.set(stage, []);
    for (const lead of optimisticLeads) {
      map.get(lead.stage)?.push(lead);
    }
    return map;
  }, [optimisticLeads]);

  function totalBudget(stage: PipelineStage): number {
    return (grouped.get(stage) ?? []).reduce((acc, lead) => acc + (lead.budgetEstimate ?? 0), 0);
  }

  async function moveLead(leadId: string, stage: PipelineStage): Promise<void> {
    const response = await fetch(`/api/v1/crm/leads/${leadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message ?? "Unable to move lead");
    }
  }

  function openScheduleModal(leadId: string): void {
    setScheduleLeadId(leadId);
    if (!scheduleDateTime) {
      const date = new Date(Date.now() + 60 * 60 * 1000);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      const hh = String(date.getHours()).padStart(2, "0");
      const mm = String(date.getMinutes()).padStart(2, "0");
      setScheduleDateTime(`${y}-${m}-${d}T${hh}:${mm}`);
    }
  }

  async function scheduleFollowUp(): Promise<void> {
    if (!scheduleLeadId || !scheduleDateTime) return;
    const parsed = new Date(scheduleDateTime);
    if (Number.isNaN(parsed.getTime())) {
      pushToast({ title: "Invalid datetime format", variant: "error" });
      return;
    }

    setSavingSchedule(true);
    try {
      const response = await fetch(`/api/v1/crm/leads/${scheduleLeadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUpAt: parsed.toISOString() }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        pushToast({ title: "Schedule failed", message: payload?.message ?? "Could not schedule follow-up", variant: "error" });
        return;
      }
      pushToast({ title: "Follow-up scheduled", variant: "success" });
      setScheduleLeadId(null);
      router.refresh();
    } finally {
      setSavingSchedule(false);
    }
  }

  return (
    <div className="grid gap-4 overflow-x-auto pb-2 xl:grid-cols-6">
      {COLUMNS.map((stage) => {
        const items = grouped.get(stage) ?? [];
        return (
          <div
            key={stage}
            className="min-h-[22rem] min-w-64 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3"
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.preventDefault();
              const leadId = event.dataTransfer.getData("text/plain");
              if (!leadId) return;
              const previousStage = optimisticLeads.find((lead) => lead.id === leadId)?.stage;
              if (!previousStage || previousStage === stage) return;
              startTransition(() => {
                updateOptimistic({ leadId, stage });
                void moveLead(leadId, stage)
                  .then(() => {
                    pushToast({ title: `Lead moved to ${stage}`, variant: "success" });
                    router.refresh();
                  })
                  .catch((error) => {
                    updateOptimistic({ leadId, stage: previousStage });
                    pushToast({
                      title: "Move failed",
                      message: error instanceof Error ? error.message : "Could not move lead",
                      variant: "error",
                    });
                  });
              });
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text)]">{stage}</h3>
              <span className="text-xs text-[var(--color-text-muted)]">{items.length}</span>
            </div>
            <p className="mb-3 text-xs text-[var(--color-text-muted)]">Rs {totalBudget(stage).toFixed(0)}</p>

            <div className="space-y-3">
              {items.map((lead) => {
                const overdue = !!lead.followUpAt && new Date(lead.followUpAt) < new Date() && !["BOOKED", "LOST"].includes(lead.stage);
                return (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", lead.id);
                    }}
                    className="cursor-grab"
                  >
                    <Link href={`/admin/crm/leads/${lead.id}`} draggable={false}>
                      <LeadCard lead={lead} overdue={overdue} />
                    </Link>
                    <div className="mt-2 flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => openScheduleModal(lead.id)}>
                        Schedule
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {isPending ? <p className="text-xs text-[var(--color-text-muted)]">Updating stage...</p> : null}

      <Modal
        open={Boolean(scheduleLeadId)}
        onClose={() => (savingSchedule ? null : setScheduleLeadId(null))}
        title="Schedule Follow-up"
        description="Set date and time for the next follow-up."
      >
        <div className="space-y-3">
          <Input
            label="Follow-up at"
            type="datetime-local"
            value={scheduleDateTime}
            onChange={(event) => setScheduleDateTime(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setScheduleLeadId(null)} disabled={savingSchedule}>
              Cancel
            </Button>
            <Button onClick={() => void scheduleFollowUp()} loading={savingSchedule}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
