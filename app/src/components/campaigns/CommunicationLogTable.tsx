import { DataTable, type DataTableColumn } from "@/components/layout/DataTable";

export interface CommunicationLogItem {
  id: string;
  channel: "SMS" | "WHATSAPP" | "EMAIL";
  status: "QUEUED" | "SENT" | "FAILED";
  recipientMobile?: string | null;
  recipientEmail?: string | null;
  template?: { id: string; name: string; channel: "SMS" | "WHATSAPP" | "EMAIL" } | null;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: string;
  sentAt?: string | null;
  errorMessage?: string | null;
}

export interface CommunicationLogTableProps {
  items: CommunicationLogItem[];
  loading?: boolean;
}

export function CommunicationLogTable({ items, loading }: CommunicationLogTableProps): JSX.Element {
  const columns: Array<DataTableColumn<CommunicationLogItem>> = [
    {
      key: "recipient",
      header: "Recipient",
      render: (row) => row.recipientMobile ?? row.recipientEmail ?? "-",
    },
    {
      key: "channel",
      header: "Channel",
      render: (row) => row.channel,
    },
    {
      key: "template",
      header: "Template",
      render: (row) => row.template?.name ?? "-",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => row.status,
    },
    {
      key: "reference",
      header: "Reference",
      render: (row) => `${row.referenceType ?? "-"} ${row.referenceId ?? ""}`,
    },
    {
      key: "time",
      header: "Time",
      render: (row) => (row.sentAt ? new Date(row.sentAt).toLocaleString("en-IN") : new Date(row.createdAt).toLocaleString("en-IN")),
    },
    {
      key: "error",
      header: "Error",
      render: (row) => row.errorMessage ?? "-",
    },
  ];

  return (
    <DataTable
      data={items}
      columns={columns}
      loading={loading}
      rowKey={(row) => row.id}
      emptyTitle="No logs"
      emptyMessage="No communication logs found for the selected filters."
    />
  );
}
