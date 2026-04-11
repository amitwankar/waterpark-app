import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { calcWaitTimeMinutes, listRideQueueSnapshot } from "@/lib/rides";

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const rides = await db.ride.findMany({
    where: { isDeleted: false },
    include: {
      zone: { select: { id: true, name: true } },
      _count: {
        select: {
          rideAccessLogs: true,
          workOrders: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const queueMap = await listRideQueueSnapshot(rides.map((ride: any) => ride.id));

  const statusCounts = new Map<string, number>();
  for (const ride of rides) {
    statusCounts.set(ride.status, (statusCounts.get(ride.status) ?? 0) + 1);
  }

  return NextResponse.json({
    statusCounts: Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count })),
    rides: rides.map((ride: any) => {
      const queueCount = queueMap[ride.id] ?? 0;
      return {
        ...ride,
        queueCount,
        waitTimeMin: calcWaitTimeMinutes(queueCount, ride.durationMin),
      };
    }),
  });
}
