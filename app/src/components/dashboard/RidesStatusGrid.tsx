"use client";

import { useOptimistic, useTransition } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";

export interface RideLiveItem {
  id: string;
  name: string;
  zone: string;
  status: "ACTIVE" | "MAINTENANCE" | "CLOSED" | "SEASONAL";
  queueCount: number;
}

export interface RidesStatusGridProps {
  items: RideLiveItem[];
  onStatusUpdate: (rideId: string, status: RideLiveItem["status"]) => Promise<void>;
}

function statusVariant(status: RideLiveItem["status"]): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "ACTIVE") return "success";
  if (status === "MAINTENANCE") return "warning";
  if (status === "CLOSED") return "danger";
  return "info";
}

export function RidesStatusGrid({ items, onStatusUpdate }: RidesStatusGridProps): JSX.Element {
  const [isPending, startTransition] = useTransition();

  const [optimisticItems, updateOptimistic] = useOptimistic(
    items,
    (current, next: { rideId: string; status: RideLiveItem["status"] }) =>
      current.map((item) => (item.id === next.rideId ? { ...item, status: next.status } : item)),
  );

  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">Rides Status</h3>
      </CardHeader>
      <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {optimisticItems.map((item) => (
          <div key={item.id} className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--color-text)]">{item.name}</p>
              <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">{item.zone}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Queue: {item.queueCount}</p>
            <Select
              options={[
                { label: "ACTIVE", value: "ACTIVE" },
                { label: "MAINTENANCE", value: "MAINTENANCE" },
                { label: "CLOSED", value: "CLOSED" },
                { label: "SEASONAL", value: "SEASONAL" },
              ]}
              value={item.status}
              onChange={(event) => {
                const nextStatus = event.target.value as RideLiveItem["status"];
                updateOptimistic({ rideId: item.id, status: nextStatus });
                startTransition(() => {
                  void onStatusUpdate(item.id, nextStatus);
                });
              }}
            />
          </div>
        ))}

        {isPending ? <p className="text-xs text-[var(--color-text-muted)]">Updating ride status...</p> : null}
      </CardBody>
    </Card>
  );
}
