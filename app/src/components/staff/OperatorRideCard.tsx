"use client";

import { useState } from "react";
import Link from "next/link";

import { QueueCounter } from "@/components/rides/QueueCounter";
import { RideRequirements } from "@/components/rides/RideRequirements";
import { RideStatusModal } from "@/components/rides/RideStatusModal";
import { WaitTimeBadge } from "@/components/rides/WaitTimeBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface OperatorRideCardProps {
  ride: {
    id: string;
    name: string;
    zone: { id: string; name: string };
    status: "ACTIVE" | "MAINTENANCE" | "CLOSED" | "SEASONAL";
    minHeight: number | null;
    maxWeight: number | null;
    durationMin: number;
    queueCount: number;
    waitTimeMin: number;
  };
}

export function OperatorRideCard({ ride }: OperatorRideCardProps): JSX.Element {
  const [queueCount, setQueueCount] = useState(ride.queueCount);
  const [waitTime, setWaitTime] = useState(ride.waitTimeMin);
  const [openStatus, setOpenStatus] = useState(false);

  return (
    <Card>
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">{ride.name}</h3>
          <p className="text-xs text-[var(--color-text-muted)]">{ride.zone.name}</p>
        </div>
        <Badge variant={ride.status === "ACTIVE" ? "success" : ride.status === "CLOSED" ? "danger" : "warning"}>
          {ride.status}
        </Badge>
      </CardHeader>

      <CardBody className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <span>{ride.durationMin} min / cycle</span>
          <span>•</span>
          <WaitTimeBadge waitTimeMin={waitTime} />
        </div>

        <RideRequirements minHeight={ride.minHeight} maxWeight={ride.maxWeight} />

        <QueueCounter
          rideId={ride.id}
          initialCount={queueCount}
          waitTimeMin={waitTime}
          canReset
          onUpdated={(nextCount, nextWaitTime) => {
            setQueueCount(nextCount);
            setWaitTime(nextWaitTime);
          }}
        />

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpenStatus(true)}>
            Mark Maintenance
          </Button>
          <Link href={`/staff/rides/${ride.id}/access-log`}>
            <Button variant="ghost" size="sm">
              Access Log
            </Button>
          </Link>
        </div>
      </CardBody>

      <RideStatusModal
        open={openStatus}
        onClose={() => setOpenStatus(false)}
        rideId={ride.id}
        currentStatus={ride.status}
      />
    </Card>
  );
}
