import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/layout/DataTable";
import { Button } from "@/components/ui/Button";
import { ServiceStatusBadge } from "@/components/maintenance/ServiceStatusBadge";

export interface AssetListItem {
  id: string;
  name: string;
  assetType: string;
  location: string | null;
  serialNumber: string | null;
  lastServiceDate: string | null;
  nextServiceDate: string | null;
  isActive: boolean;
}

export interface AssetTableProps {
  items: AssetListItem[];
  loading?: boolean;
  onService: (assetId: string) => void;
}

function fmtDate(date: string | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-IN");
}

export function AssetTable({ items, loading, onService }: AssetTableProps): JSX.Element {
  const columns: Array<DataTableColumn<AssetListItem>> = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <div>
          <p className="font-medium text-[var(--color-text)]">{row.name}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{row.assetType}</p>
        </div>
      ),
    },
    {
      key: "location",
      header: "Location",
      render: (row) => row.location ?? "-",
    },
    {
      key: "serialNumber",
      header: "Serial",
      render: (row) => row.serialNumber ?? "-",
    },
    {
      key: "lastServiceDate",
      header: "Last Service",
      render: (row) => fmtDate(row.lastServiceDate),
    },
    {
      key: "nextServiceDate",
      header: "Next Service",
      render: (row) => fmtDate(row.nextServiceDate),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <ServiceStatusBadge nextServiceDate={row.nextServiceDate} />,
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onService(row.id)}>
            Service
          </Button>
          <Link href={`/admin/maintenance/assets/${row.id}`}>
            <Button size="sm" variant="ghost">
              View
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={items}
      columns={columns}
      rowKey={(row) => row.id}
      loading={loading}
      emptyTitle="No assets found"
      emptyMessage="Add a maintenance asset to begin tracking service schedules."
    />
  );
}
