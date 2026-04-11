import { LiveRidesList } from "@/components/website/LiveRidesList";
import { db } from "@/lib/db";

export default async function WebsiteRidesPage(): Promise<JSX.Element> {
  const rides = await db.ride.findMany({
    where: { isDeleted: false },
    include: {
      zone: { select: { id: true, name: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)]">Rides & Wait Times</h1>
        <p className="text-[var(--color-text-muted)]">
          Live queue counters refresh every 60 seconds.
        </p>
      </div>
      <LiveRidesList
        initialRides={rides.map((ride) => ({
          id: ride.id,
          name: ride.name,
          description: ride.description,
          status: ride.status as "ACTIVE" | "MAINTENANCE" | "CLOSED" | "SEASONAL",
          imageUrl: ride.imageUrl,
          minHeight: ride.minHeight,
          maxWeight: ride.maxWeight,
          durationMin: ride.durationMin,
          waitTimeMin: 0,
          queueCount: 0,
          zone: { id: ride.zone.id, name: ride.zone.name },
        }))}
      />
    </div>
  );
}
