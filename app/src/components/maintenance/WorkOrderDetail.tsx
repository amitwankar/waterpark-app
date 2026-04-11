import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";
import { PriorityBadge } from "@/components/maintenance/PriorityBadge";
import { Badge } from "@/components/ui/Badge";

export interface WorkOrderDetailProps {
  workOrder: {
    id: string;
    workOrderNumber: string;
    title: string;
    description: string | null;
    priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    dueDate: string | null;
    createdAt: string;
    completedAt: string | null;
    resolutionNotes: string | null;
    asset: { id: string; name: string; assetType: string; location: string | null };
    ride?: { id: string; name: string; status: string } | null;
  };
}

function statusVariant(status: WorkOrderDetailProps["workOrder"]["status"]): "default" | "warning" | "success" | "danger" {
  if (status === "OPEN") return "default";
  if (status === "IN_PROGRESS") return "warning";
  if (status === "COMPLETED") return "success";
  return "danger";
}

function extractCost(notes: string | null): number | null {
  if (!notes) return null;
  const line = notes.split("\n").find((entry) => entry.startsWith("ACTUAL_COST:"));
  if (!line) return null;
  const value = Number(line.replace("ACTUAL_COST:", ""));
  return Number.isFinite(value) ? value : null;
}

export function WorkOrderDetail({ workOrder }: WorkOrderDetailProps): JSX.Element {
  const cost = extractCost(workOrder.resolutionNotes);

  return (
    <Card>
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">{workOrder.workOrderNumber}</p>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{workOrder.title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <PriorityBadge priority={workOrder.priority} />
          <Badge variant={statusVariant(workOrder.status)}>{workOrder.status}</Badge>
        </div>
      </CardHeader>
      <CardBody className="space-y-4 text-sm">
        <div>
          <p className="whitespace-pre-wrap text-[var(--color-text)]">{workOrder.description || "-"}</p>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
          <p className="text-xs text-[var(--color-text-muted)]">Asset</p>
          <p className="font-medium text-[var(--color-text)]">{workOrder.asset.name}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {workOrder.asset.assetType} • {workOrder.asset.location ?? "No location"}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Created</p>
            <p>{new Date(workOrder.createdAt).toLocaleString("en-IN")}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Due</p>
            <p>{workOrder.dueDate ? new Date(workOrder.dueDate).toLocaleString("en-IN") : "-"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Completed</p>
            <p>{workOrder.completedAt ? new Date(workOrder.completedAt).toLocaleString("en-IN") : "-"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Cost</p>
            <p>{cost !== null ? formatCurrency(cost) : "-"}</p>
          </div>
        </div>

        {workOrder.ride ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
            <p className="text-xs text-[var(--color-text-muted)]">Linked Ride</p>
            <p className="font-medium text-[var(--color-text)]">{workOrder.ride.name}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Status: {workOrder.ride.status}</p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
