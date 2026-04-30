import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/layout/DataTable";
import { PriorityBadge } from "@/components/maintenance/PriorityBadge";
import { Badge } from "@/components/ui/Badge";

export interface WorkOrderListItem {
  id: string;
  workOrderNumber: string;
  title: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  dueDate: string | null;
  isOverdue: boolean;
  asset?: {
    id: string;
    name: string;
    assetType: string;
  } | null;
  assignee?: { id: string; name: string } | null;
}

export interface WorkOrderTableProps {
  items: WorkOrderListItem[];
  loading?: boolean;
  onDelete?: (workOrderId: string) => void;
}

function statusVariant(status: WorkOrderListItem["status"]): "default" | "warning" | "success" | "danger" {
  if (status === "OPEN") return "default";
  if (status === "IN_PROGRESS") return "warning";
  if (status === "COMPLETED") return "success";
  return "danger";
}

export function WorkOrderTable({ items, loading, onDelete }: WorkOrderTableProps): JSX.Element {
  const columns: Array<DataTableColumn<WorkOrderListItem>> = [
    {
      key: "wo",
      header: "WO No.",
      render: (row) => row.workOrderNumber,
    },
    {
      key: "title",
      header: "Title",
      render: (row) => (
        <div>
          <p className="font-medium text-[var(--color-text)]">{row.title}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{row.asset?.name ?? "Asset unavailable"}</p>
        </div>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (row) => <PriorityBadge priority={row.priority} />,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge>,
    },
    {
      key: "assigned",
      header: "Assigned",
      render: (row) => row.assignee?.name ?? "Unassigned",
    },
    {
      key: "due",
      header: "Due",
      render: (row) => (
        <span className={row.isOverdue ? "font-semibold text-[var(--color-danger)]" : ""}>
          {row.dueDate ? new Date(row.dueDate).toLocaleDateString("en-IN") : "-"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/maintenance/work-orders/${row.id}`}
            className="inline-flex h-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] transition-all duration-150 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            View
          </Link>
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(row.id)}
              className="inline-flex h-8 items-center justify-center rounded-[var(--radius-md)] border border-red-300 bg-red-50 px-3 text-sm font-medium text-red-700 transition-all duration-150 hover:bg-red-100"
            >
              Delete
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={items}
      columns={columns}
      loading={loading}
      rowKey={(row) => row.id}
      emptyTitle="No work orders"
      emptyMessage="Create a work order to begin maintenance tracking."
    />
  );
}
