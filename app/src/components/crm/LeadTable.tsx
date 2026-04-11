"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/feedback/Toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

export interface LeadTableRow {
  id: string;
  name: string;
  mobile: string;
  source: string;
  type: string | null;
  stage: string;
  groupSize: number | null;
  budgetEstimate: number | null;
  followUpAt: string | null;
  assignedToName: string | null;
}

export interface LeadTableProps {
  rows: LeadTableRow[];
}

function followUpClass(followUpAt: string | null): string {
  if (!followUpAt) return "text-[var(--color-text-muted)]";
  const now = new Date();
  const target = new Date(followUpAt);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diff = startOfTarget.getTime() - startOfToday.getTime();

  if (diff < 0) return "text-red-600";
  if (diff === 0) return "text-amber-600";
  return "text-[var(--color-text-muted)]";
}

export function LeadTable({ rows }: LeadTableProps): JSX.Element {
  const router = useRouter();
  const { pushToast } = useToast();
  const [scheduleLeadId, setScheduleLeadId] = useState<string | null>(null);
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);

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
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">Lead Table</h3>
      </CardHeader>
      <CardBody className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
              <th className="py-2 pr-2">Name</th>
              <th className="py-2 pr-2">Mobile</th>
              <th className="py-2 pr-2">Source</th>
              <th className="py-2 pr-2">Type</th>
              <th className="py-2 pr-2">Stage</th>
              <th className="py-2 pr-2">Group</th>
              <th className="py-2 pr-2">Budget</th>
              <th className="py-2 pr-2">Follow Up</th>
              <th className="py-2 pr-2">Assigned</th>
              <th className="py-2 pr-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[var(--color-border)] last:border-b-0">
                <td className="py-2 pr-2 text-[var(--color-text)]">{row.name}</td>
                <td className="py-2 pr-2">{row.mobile}</td>
                <td className="py-2 pr-2"><Badge variant="info">{row.source}</Badge></td>
                <td className="py-2 pr-2">{row.type ?? "-"}</td>
                <td className="py-2 pr-2"><Badge variant="default">{row.stage}</Badge></td>
                <td className="py-2 pr-2">{row.groupSize ?? "-"}</td>
                <td className="py-2 pr-2">{row.budgetEstimate ? `Rs ${row.budgetEstimate.toFixed(0)}` : "-"}</td>
                <td className={`py-2 pr-2 ${followUpClass(row.followUpAt)}`}>{row.followUpAt ? new Date(row.followUpAt).toLocaleDateString("en-IN") : "-"}</td>
                <td className="py-2 pr-2">{row.assignedToName ?? "-"}</td>
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/crm/leads/${row.id}`} className="text-[var(--color-primary)] underline">
                      View
                    </Link>
                    <Button size="sm" variant="outline" onClick={() => openScheduleModal(row.id)}>
                      Schedule
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>

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
    </Card>
  );
}
