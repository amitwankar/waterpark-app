"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PriorityBadge } from "@/components/maintenance/PriorityBadge";

export interface TechWorkOrderCardProps {
  workOrder: {
    id: string;
    workOrderNumber: string;
    title: string;
    priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    dueDate: string | null;
    asset: { id: string; name: string; assetType: string };
  };
  onChanged?: () => void;
}

export function TechWorkOrderCard({ workOrder, onChanged }: TechWorkOrderCardProps): JSX.Element {
  const [isPending, startTransition] = useTransition();
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [actualCost, setActualCost] = useState("");

  return (
    <Card>
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">{workOrder.workOrderNumber}</p>
          <h3 className="text-base font-semibold text-[var(--color-text)]">{workOrder.title}</h3>
          <p className="text-xs text-[var(--color-text-muted)]">{workOrder.asset.name}</p>
        </div>
        <PriorityBadge priority={workOrder.priority} />
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          Due: {workOrder.dueDate ? new Date(workOrder.dueDate).toLocaleDateString("en-IN") : "-"}
        </p>

        <div className="flex flex-wrap gap-2">
          {workOrder.status === "OPEN" ? (
            <Button
              size="sm"
              variant="outline"
              loading={isPending}
              onClick={() => {
                startTransition(() => {
                  void fetch(`/api/v1/maintenance/work-orders/${workOrder.id}/accept`, { method: "POST" }).then(() => onChanged?.());
                });
              }}
            >
              Accept
            </Button>
          ) : null}

          {workOrder.status === "IN_PROGRESS" ? (
            <Button size="sm" variant="secondary" disabled>
              In Progress
            </Button>
          ) : null}
        </div>

        {["OPEN", "IN_PROGRESS"].includes(workOrder.status) ? (
          <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
            <textarea
              value={resolutionNotes}
              onChange={(event) => setResolutionNotes(event.target.value)}
              className="h-20 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm outline-none"
              placeholder="Resolution notes"
            />
            <input
              type="number"
              min={0}
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm"
              placeholder="Actual cost"
              value={actualCost}
              onChange={(event) => setActualCost(event.target.value)}
            />
            <Button
              size="sm"
              loading={isPending}
              onClick={() => {
                if (!resolutionNotes.trim()) return;
                startTransition(() => {
                  void fetch(`/api/v1/maintenance/work-orders/${workOrder.id}/complete`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      resolutionNotes,
                      actualCost: actualCost ? Number(actualCost) : undefined,
                    }),
                  }).then(() => {
                    setResolutionNotes("");
                    setActualCost("");
                    onChanged?.();
                  });
                });
              }}
            >
              Complete
            </Button>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
