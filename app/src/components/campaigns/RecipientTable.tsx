import { DataTable, type DataTableColumn } from "@/components/layout/DataTable";

export interface RecipientTableItem {
  id: string;
  name: string;
  mobile?: string | null;
  email?: string | null;
  deliveryStatus: string;
  sentAt?: string | null;
  errorMessage?: string | null;
}

export interface RecipientTableProps {
  items: RecipientTableItem[];
  loading?: boolean;
}

export function RecipientTable({ items, loading }: RecipientTableProps): JSX.Element {
  const columns: Array<DataTableColumn<RecipientTableItem>> = [
    {
      key: "name",
      header: "Recipient",
      render: (row) => (
        <div>
          <p className="font-medium text-[var(--color-text)]">{row.name}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{row.mobile ?? row.email ?? "-"}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => row.deliveryStatus,
    },
    {
      key: "sentAt",
      header: "Sent At",
      render: (row) => (row.sentAt ? new Date(row.sentAt).toLocaleString("en-IN") : "-"),
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
      emptyTitle="No recipients"
      emptyMessage="Run campaign send to populate recipients."
    />
  );
}
