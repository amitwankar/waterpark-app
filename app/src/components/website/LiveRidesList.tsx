"use client";

import { useEffect, useMemo, useState } from "react";

type RideItem = {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "MAINTENANCE" | "CLOSED" | "SEASONAL";
  imageUrl: string | null;
  minHeight: number | null;
  maxWeight: number | null;
  durationMin: number;
  waitTimeMin: number;
  queueCount: number;
  zone: {
    id: string;
    name: string;
  };
};

interface LiveRidesListProps {
  initialRides: RideItem[];
}

export function LiveRidesList({ initialRides }: LiveRidesListProps): JSX.Element {
  const [rides, setRides] = useState<RideItem[]>(initialRides);
  const [zone, setZone] = useState<string>("ALL");
  const [openOnly, setOpenOnly] = useState(false);

  useEffect(() => {
    const refresh = async (): Promise<void> => {
      const response = await fetch("/api/v1/rides", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json().catch(() => null)) as { items?: RideItem[] } | null;
      setRides(payload?.items ?? []);
    };

    const timer = window.setInterval(() => {
      void refresh();
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  const zones = useMemo(
    () =>
      Array.from(new Set(rides.map((ride) => ride.zone.name))).sort((a, b) =>
        a.localeCompare(b, "en-IN"),
      ),
    [rides],
  );

  const filtered = useMemo(() => {
    return rides.filter((ride) => {
      if (zone !== "ALL" && ride.zone.name !== zone) return false;
      if (openOnly && ride.status !== "ACTIVE") return false;
      return true;
    });
  }, [openOnly, rides, zone]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setZone("ALL")}
          className={`rounded-[var(--radius-full)] px-3 py-1.5 text-sm ${
            zone === "ALL" ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface-muted)] text-[var(--color-text)]"
          }`}
        >
          All Zones
        </button>
        {zones.map((zoneName) => (
          <button
            key={zoneName}
            type="button"
            onClick={() => setZone(zoneName)}
            className={`rounded-[var(--radius-full)] px-3 py-1.5 text-sm ${
              zone === zoneName ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface-muted)] text-[var(--color-text)]"
            }`}
          >
            {zoneName}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpenOnly((prev) => !prev)}
          className={`rounded-[var(--radius-full)] px-3 py-1.5 text-sm ${
            openOnly ? "bg-[var(--color-secondary)] text-white" : "bg-[var(--color-surface-muted)] text-[var(--color-text)]"
          }`}
        >
          {openOnly ? "Open Now" : "All Status"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((ride) => (
          <article key={ride.id} className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <img
              src={ride.imageUrl ?? `https://picsum.photos/seed/ride-${ride.id}/900/600`}
              alt={ride.name}
              className="h-44 w-full object-cover"
            />
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[var(--color-text)]">{ride.name}</h3>
                <span
                  className={`rounded-[var(--radius-full)] px-2.5 py-1 text-xs font-medium ${
                    ride.status === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-700"
                      : ride.status === "MAINTENANCE"
                        ? "bg-red-100 text-red-700"
                        : "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  {ride.status}
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">{ride.zone.name}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] px-2 py-1">
                  Queue: {ride.queueCount}
                </p>
                <p className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] px-2 py-1">
                  Wait: {ride.waitTimeMin} min
                </p>
                <p className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] px-2 py-1">
                  Height: {ride.minHeight ? `${ride.minHeight} cm+` : "Any"}
                </p>
                <p className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] px-2 py-1">
                  Duration: {ride.durationMin} min
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
