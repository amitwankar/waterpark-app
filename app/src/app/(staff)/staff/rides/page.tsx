"use client";

import { useEffect, useMemo, useState } from "react";
import { Waves } from "lucide-react";

import { OperatorRideCard } from "@/components/staff/OperatorRideCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { authClient } from "@/lib/auth-client";

interface RideItem {
  id: string;
  name: string;
  status: "ACTIVE" | "MAINTENANCE" | "CLOSED" | "SEASONAL";
  minHeight: number | null;
  maxWeight: number | null;
  durationMin: number;
  queueCount: number;
  waitTimeMin: number;
  zone: { id: string; name: string };
  operator?: { id: string; name: string } | null;
}

interface RidesResponse {
  items: RideItem[];
}

export default function StaffRidesPage(): JSX.Element {
  const { data: session } = authClient.useSession();
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [rides, setRides] = useState<RideItem[]>([]);

  async function loadRides(): Promise<void> {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/rides", { method: "GET" });
      const payload = (await response.json().catch(() => ({ items: [] }))) as RidesResponse;
      if (response.ok) {
        setRides(payload.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRides();
  }, []);

  const userId = String(session?.user?.id ?? "");
  const visibleRides = useMemo(() => {
    if (showAll) return rides;
    if (!userId) return rides;
    const assigned = rides.filter((ride) => ride.operator?.id === userId);
    return assigned.length > 0 ? assigned : rides;
  }, [rides, showAll, userId]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ride Operator Panel"
        subtitle="Manage queue counts, wait times, and status updates."
        actions={[
          {
            key: "toggle",
            element: (
              <Button variant={showAll ? "primary" : "outline"} onClick={() => setShowAll((state) => !state)}>
                {showAll ? "Assigned Only" : "All Rides"}
              </Button>
            ),
          },
        ]}
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-96 w-full" />
          ))}
        </div>
      ) : null}

      {!loading && visibleRides.length === 0 ? (
        <EmptyState
          icon={Waves}
          title="No rides assigned"
          message="No rides are currently assigned to your operator account."
        />
      ) : null}

      {!loading && visibleRides.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleRides.map((ride) => (
            <OperatorRideCard key={ride.id} ride={ride} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
