import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/layout/DataTable";
import { Button } from "@/components/ui/Button";
import { CampaignProgress } from "@/components/campaigns/CampaignProgress";

export interface CampaignTableItem {
  id: string;
  name: string;
  channel: "SMS" | "WHATSAPP" | "EMAIL";
  status: "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "CANCELLED";
  targetCount: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  scheduledAt: string | null;
  createdAt: string;
}

export interface CampaignTableProps {
  items: CampaignTableItem[];
  loading?: boolean;
  onSend?: (campaignId: string) => void;
  onCancel?: (campaignId: string) => void;
}

export function CampaignTable({ items, loading, onSend, onCancel }: CampaignTableProps): JSX.Element {
  const columns: Array<DataTableColumn<CampaignTableItem>> = [
    {
      key: "name",
      header: "Campaign",
      render: (row) => (
        <div>
          <p className="font-medium text-[var(--color-text)]">{row.name}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{row.channel}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <span className="text-sm font-medium">{row.status}</span>,
    },
    {
      key: "progress",
      header: "Progress",
      render: (row) => (
        <CampaignProgress
          targetCount={row.targetCount}
          sentCount={row.sentCount}
          deliveredCount={row.deliveredCount}
          failedCount={row.failedCount}
        />
      ),
    },
    {
      key: "schedule",
      header: "Schedule",
      render: (row) => (row.scheduledAt ? new Date(row.scheduledAt).toLocaleString("en-IN") : "Now"),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/campaigns/${row.id}`}>
            <Button size="sm" variant="outline">View</Button>
          </Link>
          {row.status !== "SENDING" && row.status !== "SENT" ? (
            <Button size="sm" onClick={() => onSend?.(row.id)}>Send</Button>
          ) : null}
          {row.status === "SENDING" ? (
            <Button size="sm" variant="danger" onClick={() => onCancel?.(row.id)}>Cancel</Button>
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
      emptyTitle="No campaigns"
      emptyMessage="Create your first campaign to reach guests and leads."
    />
  );
}
