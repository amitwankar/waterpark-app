"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { AccessLogTable } from "@/components/rides/AccessLogTable";
import { InspectionForm } from "@/components/rides/InspectionForm";
import { InspectionHistory, type InspectionHistoryItem } from "@/components/rides/InspectionHistory";
import { RideRequirements } from "@/components/rides/RideRequirements";
import { RideStatusModal } from "@/components/rides/RideStatusModal";
import { WaitTimeBadge } from "@/components/rides/WaitTimeBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

interface RideDetail {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "MAINTENANCE" | "CLOSED" | "SEASONAL";
  imageUrl: string | null;
  zone: { id: string; name: string };
  durationMin: number;
  capacity: number;
  isUnlimitedCapacity?: boolean;
  minHeight: number | null;
  maxWeight: number | null;
  queueCount: number;
  waitTimeMin: number;
  rideAccessLogs: Array<{
    id: string;
    scannedAt: string;
    booking: {
      bookingNumber: string;
      guestName: string;
      guestMobile: string;
    };
  }>;
  workOrders: Array<{
    id: string;
    title: string;
    status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    dueDate: string | null;
    createdAt: string;
  }>;
}

interface RideResponse {
  ride: RideDetail;
}

interface InspectionResponse {
  items: InspectionHistoryItem[];
}

type TabKey = "DETAILS" | "ACCESS_LOG" | "INSPECTIONS" | "WORK_ORDERS";

export default function AdminRideDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const rideId = String(params.id ?? "");

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("DETAILS");
  const [ride, setRide] = useState<RideDetail | null>(null);
  const [inspections, setInspections] = useState<InspectionHistoryItem[]>([]);
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  async function loadRide(): Promise<void> {
    if (!rideId) return;
    setLoading(true);
    try {
      const [rideResponse, inspectionResponse] = await Promise.all([
        fetch(`/api/v1/rides/${rideId}`, { method: "GET" }),
        fetch(`/api/v1/rides/${rideId}/inspection`, { method: "GET" }),
      ]);

      const ridePayload = (await rideResponse.json().catch(() => null)) as RideResponse | null;
      const inspectionPayload = (await inspectionResponse.json().catch(() => ({ items: [] }))) as InspectionResponse;

      if (rideResponse.ok && ridePayload?.ride) {
        setRide(ridePayload.ride);
      }
      if (inspectionResponse.ok) {
        setInspections(inspectionPayload.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRide();
  }, [rideId]);

  const accessRows = useMemo(
    () =>
      (ride?.rideAccessLogs ?? []).map((item) => ({
        id: item.id,
        scannedAt: item.scannedAt,
        bookingNumber: item.booking.bookingNumber,
        guestName: item.booking.guestName,
        guestMobile: item.booking.guestMobile,
        rideName: ride?.name ?? "",
      })),
    [ride?.name, ride?.rideAccessLogs],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={ride?.name ?? "Ride Details"}
        subtitle={ride ? `${ride.zone.name} • ${ride.durationMin} min • Capacity ${ride.isUnlimitedCapacity ? "Unlimited" : ride.capacity}` : undefined}
        actions={[
          {
            key: "back",
            element: (
              <Link href="/admin/rides">
                <Button variant="outline">Back</Button>
              </Link>
            ),
          },
          {
            key: "status",
            element: (
              <Button onClick={() => setStatusModalOpen(true)} disabled={!ride}>
                Update Status
              </Button>
            ),
          },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        {(["DETAILS", "ACCESS_LOG", "INSPECTIONS", "WORK_ORDERS"] as const).map((item) => (
          <Button
            key={item}
            variant={tab === item ? "primary" : "outline"}
            size="sm"
            onClick={() => setTab(item)}
          >
            {item.replace("_", " ")}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}

      {!loading && ride && tab === "DETAILS" ? (
        <Card>
          <CardHeader className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text)]">{ride.name}</h3>
              <p className="text-sm text-[var(--color-text-muted)]">{ride.description ?? "No description"}</p>
            </div>
            <Badge variant={ride.status === "ACTIVE" ? "success" : ride.status === "CLOSED" ? "danger" : "warning"}>
              {ride.status}
            </Badge>
          </CardHeader>
          <CardBody className="space-y-4">
            {ride.imageUrl ? <img src={ride.imageUrl} alt={ride.name} className="h-56 w-full rounded-[var(--radius-md)] object-cover" /> : null}
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <span>{ride.queueCount} in queue</span>
              <span>•</span>
              <WaitTimeBadge waitTimeMin={ride.waitTimeMin} />
            </div>
            <RideRequirements minHeight={ride.minHeight} maxWeight={ride.maxWeight} />
          </CardBody>
        </Card>
      ) : null}

      {!loading && ride && tab === "ACCESS_LOG" ? <AccessLogTable rows={accessRows} /> : null}

      {!loading && ride && tab === "INSPECTIONS" ? (
        <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <InspectionForm rideId={ride.id} onCreated={() => void loadRide()} />
          <InspectionHistory items={inspections} />
        </div>
      ) : null}

      {!loading && ride && tab === "WORK_ORDERS" ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-[var(--color-text)]">Work Orders</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            {ride.workOrders.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No linked work orders.</p>
            ) : (
              ride.workOrders.map((workOrder) => (
                <div key={workOrder.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[var(--color-text)]">{workOrder.title}</p>
                    <Badge variant={workOrder.priority === "CRITICAL" ? "danger" : "warning"}>{workOrder.priority}</Badge>
                    <Badge variant={workOrder.status === "COMPLETED" ? "success" : "default"}>{workOrder.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Due: {workOrder.dueDate ? new Date(workOrder.dueDate).toLocaleDateString("en-IN") : "N/A"}
                  </p>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      ) : null}

      {ride ? (
        <RideStatusModal
          open={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          rideId={ride.id}
          currentStatus={ride.status}
          onUpdated={() => void loadRide()}
        />
      ) : null}
    </div>
  );
}
