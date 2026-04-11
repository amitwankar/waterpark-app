"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { RideDrawer } from "@/components/rides/RideDrawer";
import { RideGrid } from "@/components/rides/RideGrid";
import { ZoneTabs } from "@/components/rides/ZoneTabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

interface ZoneItem {
  id: string;
  name: string;
}

interface RideItem {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "MAINTENANCE" | "CLOSED" | "SEASONAL";
  imageUrl: string | null;
  entryFee: number;
  gstRate: number;
  capacity: number;
  isUnlimitedCapacity?: boolean;
  sortOrder?: number;
  durationMin: number;
  minHeight: number | null;
  maxWeight: number | null;
  zone: { id: string; name: string };
  queueCount: number;
  waitTimeMin: number;
  operator?: { id: string; name: string } | null;
}

interface RidesResponse {
  items: RideItem[];
}

interface ZonesResponse {
  items: ZoneItem[];
}

export default function AdminRidesPage(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRide, setEditingRide] = useState<RideItem | null>(null);
  const [operators, setOperators] = useState<Array<{ id: string; name: string }>>([]);

  async function loadData(zoneId?: string): Promise<void> {
    setLoading(true);
    try {
      const zoneQuery = zoneId ? `?zoneId=${zoneId}` : "";
      const [ridesResponse, zonesResponse] = await Promise.all([
        fetch(`/api/v1/rides${zoneQuery}`, { method: "GET" }),
        fetch("/api/v1/zones", { method: "GET" }),
      ]);

      const ridesPayload = (await ridesResponse.json().catch(() => ({ items: [] }))) as RidesResponse;
      const zonesPayload = (await zonesResponse.json().catch(() => ({ items: [] }))) as ZonesResponse;

      if (ridesResponse.ok) {
        setRides(ridesPayload.items ?? []);
      }
      if (zonesResponse.ok) {
        setZones((zonesPayload.items ?? []).map((zone) => ({ id: zone.id, name: zone.name })));
      }

      const operatorsResponse = await fetch("/api/v1/staff?subRole=RIDE_OPERATOR&isActive=true", { method: "GET" });
      if (operatorsResponse.ok) {
        const operatorsPayload = (await operatorsResponse.json().catch(() => [])) as Array<{
          id: string;
          name: string;
        }>;
        setOperators(operatorsPayload.map((operator) => ({ id: operator.id, name: operator.name })));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredRides = useMemo(
    () => (activeZoneId ? rides.filter((ride) => ride.zone.id === activeZoneId) : rides),
    [activeZoneId, rides],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rides"
        subtitle="Manage rides, live queues, and operational status."
        actions={[
          {
            key: "add",
            element: (
              <Button
                onClick={() => {
                  setEditingRide(null);
                  setDrawerOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add Ride
              </Button>
            ),
          },
        ]}
      />

      <ZoneTabs
        zones={zones}
        basePath="/admin/rides"
        activeZoneId={activeZoneId || undefined}
        onChange={(zoneId) => setActiveZoneId(zoneId)}
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-96 w-full" />
          ))}
        </div>
      ) : null}

      {!loading && filteredRides.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No rides found"
          message="Try another zone filter or add a new ride."
        />
      ) : null}

      {!loading && filteredRides.length > 0 ? (
        <RideGrid
          rides={filteredRides}
          adminMode
          onEdit={(ride) => {
            setEditingRide(ride);
            setDrawerOpen(true);
          }}
          onChanged={() => void loadData(activeZoneId || undefined)}
        />
      ) : null}

      <RideDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingRide(null);
        }}
        zones={zones}
        operators={operators}
        ride={editingRide}
        onSaved={() => {
          setDrawerOpen(false);
          setEditingRide(null);
          void loadData(activeZoneId || undefined);
        }}
      />
    </div>
  );
}
