"use client";

import { useState } from "react";

import { QueueCounter } from "@/components/rides/QueueCounter";
import { RideRequirements } from "@/components/rides/RideRequirements";
import { RideStatusModal } from "@/components/rides/RideStatusModal";
import { WaitTimeBadge } from "@/components/rides/WaitTimeBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";

export interface RideCardProps {
  ride: {
    id: string;
    name: string;
    description: string | null;
    status: "ACTIVE" | "MAINTENANCE" | "CLOSED" | "SEASONAL";
    imageUrl: string | null;
    entryFee: number;
    gstRate: number;
    capacity: number;
    durationMin: number;
    minHeight: number | null;
    maxWeight: number | null;
    zone: { id: string; name: string };
    queueCount: number;
    waitTimeMin: number;
    operator?: { id: string; name: string } | null;
    isUnlimitedCapacity?: boolean;
  };
  adminMode?: boolean;
  onEdit?: (ride: RideCardProps["ride"]) => void;
  onChanged?: () => void;
}

function statusVariant(status: RideCardProps["ride"]["status"]): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "ACTIVE") return "success";
  if (status === "MAINTENANCE") return "warning";
  if (status === "CLOSED") return "danger";
  return "info";
}

export function RideCard({ ride, adminMode = false, onEdit, onChanged }: RideCardProps): JSX.Element {
  const [openStatus, setOpenStatus] = useState(false);
  const [queueCount, setQueueCount] = useState(ride.queueCount);
  const [waitTime, setWaitTime] = useState(ride.waitTimeMin);
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <Card className="overflow-hidden">
      {ride.imageUrl ? <img src={ride.imageUrl} alt={ride.name} className="h-44 w-full object-cover" /> : null}
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-base font-semibold text-[var(--color-text)]">{ride.name}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{ride.zone.name}</p>
          </div>
          <Badge variant={statusVariant(ride.status)}>{ride.status}</Badge>
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span>Capacity {ride.isUnlimitedCapacity ? "Unlimited" : ride.capacity}</span>
          <span>•</span>
          <span>{ride.durationMin} min / cycle</span>
          <span>•</span>
          <span>₹{Number(ride.entryFee ?? 0).toFixed(0)} + {Number(ride.gstRate ?? 0)}% GST</span>
          <span>•</span>
          <WaitTimeBadge waitTimeMin={waitTime} />
        </div>

        <RideRequirements minHeight={ride.minHeight} maxWeight={ride.maxWeight} compact />

        <QueueCounter
          rideId={ride.id}
          initialCount={queueCount}
          waitTimeMin={waitTime}
          canReset={adminMode}
          onUpdated={(nextCount, waitMin) => {
            setQueueCount(nextCount);
            setWaitTime(waitMin);
          }}
        />

        {adminMode ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpenStatus(true)}>Change Status</Button>
            <Button size="sm" variant="outline" onClick={() => onEdit?.(ride)}>Edit</Button>
            <Button
              size="sm"
              variant="outline"
              loading={isDeleting}
              onClick={async () => {
                if (!confirm(`Delete "${ride.name}"?`)) return;
                setIsDeleting(true);
                try {
                  await fetch(`/api/v1/rides/${ride.id}`, { method: "DELETE" });
                  onChanged?.();
                } finally {
                  setIsDeleting(false);
                }
              }}
            >
              Delete
            </Button>
            <a href={`/admin/rides/${ride.id}`} className="inline-flex">
              <Button size="sm" variant="ghost">Open</Button>
            </a>
          </div>
        ) : null}
      </CardBody>

      <RideStatusModal
        open={openStatus}
        onClose={() => setOpenStatus(false)}
        rideId={ride.id}
        currentStatus={ride.status}
        onUpdated={onChanged}
      />
    </Card>
  );
}
