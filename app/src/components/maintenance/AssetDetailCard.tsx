import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ServiceStatusBadge } from "@/components/maintenance/ServiceStatusBadge";
import { WarrantyBadge } from "@/components/maintenance/WarrantyBadge";

export interface AssetDetailCardProps {
  asset: {
    id: string;
    name: string;
    assetType: string;
    location: string | null;
    serialNumber: string | null;
    purchaseDate: string | null;
    warrantyExpiry: string | null;
    lastServiceDate: string | null;
    nextServiceDate: string | null;
    isActive: boolean;
  };
}

function fmt(date: string | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-IN");
}

export function AssetDetailCard({ asset }: AssetDetailCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-[var(--color-text)]">Asset Details</h2>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">Name</p>
          <p className="font-medium text-[var(--color-text)]">{asset.name}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Type</p>
            <p>{asset.assetType}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Location</p>
            <p>{asset.location ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Serial</p>
            <p>{asset.serialNumber ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Purchase Date</p>
            <p>{fmt(asset.purchaseDate)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Last Service</p>
            <p>{fmt(asset.lastServiceDate)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Next Service</p>
            <p>{fmt(asset.nextServiceDate)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ServiceStatusBadge nextServiceDate={asset.nextServiceDate} />
          <WarrantyBadge warrantyExpiry={asset.warrantyExpiry} />
        </div>
      </CardBody>
    </Card>
  );
}
