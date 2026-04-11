import { AlertTriangle, CheckCircle2, Wrench } from "lucide-react";

import { Card, CardBody } from "@/components/ui/Card";

export interface MaintenanceSummaryBarProps {
  total: number;
  dueSoon: number;
  overdue: number;
  underMaintenance: number;
}

export function MaintenanceSummaryBar({
  total,
  dueSoon,
  overdue,
  underMaintenance,
}: MaintenanceSummaryBarProps): JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardBody className="flex items-center justify-between py-3">
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Total Assets</p>
            <p className="text-xl font-semibold text-[var(--color-text)]">{total}</p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-[var(--color-success)]" />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex items-center justify-between py-3">
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Due Soon</p>
            <p className="text-xl font-semibold text-amber-600">{dueSoon}</p>
          </div>
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex items-center justify-between py-3">
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Overdue</p>
            <p className="text-xl font-semibold text-[var(--color-danger)]">{overdue}</p>
          </div>
          <AlertTriangle className="h-5 w-5 text-[var(--color-danger)]" />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex items-center justify-between py-3">
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Under Maintenance</p>
            <p className="text-xl font-semibold text-[var(--color-text)]">{underMaintenance}</p>
          </div>
          <Wrench className="h-5 w-5 text-[var(--color-primary)]" />
        </CardBody>
      </Card>
    </div>
  );
}
