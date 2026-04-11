import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface InspectionHistoryItem {
  id: string;
  createdAt: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  creator?: { id: string; name: string } | null;
  meta?: {
    checklistPassed?: boolean;
    notes?: string;
  };
}

export interface InspectionHistoryProps {
  items: InspectionHistoryItem[];
}

function priorityVariant(priority: InspectionHistoryItem["priority"]): "default" | "warning" | "danger" {
  if (priority === "CRITICAL" || priority === "HIGH") return "danger";
  if (priority === "MEDIUM") return "warning";
  return "default";
}

function statusVariant(status: InspectionHistoryItem["status"]): "default" | "success" | "warning" | "danger" {
  if (status === "COMPLETED") return "success";
  if (status === "OPEN" || status === "IN_PROGRESS") return "warning";
  if (status === "CANCELLED") return "danger";
  return "default";
}

export function InspectionHistory({ items }: InspectionHistoryProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">Inspection History</h3>
      </CardHeader>
      <CardBody className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No inspections logged yet.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-[var(--color-text)]">
                  {new Date(item.createdAt).toLocaleString("en-IN")}
                </p>
                <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                {item.meta?.checklistPassed !== undefined ? (
                  <Badge variant={item.meta.checklistPassed ? "success" : "danger"}>
                    {item.meta.checklistPassed ? "PASSED" : "FAILED"}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Inspector: {item.creator?.name ?? "Unknown"}
              </p>
              {item.meta?.notes ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text)]">{item.meta.notes}</p>
              ) : null}
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}
