import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (getRole(session) !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const rides = await db.ride.findMany({
    where: { isDeleted: false },
    include: {
      zone: {
        select: { name: true },
      },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const items = await Promise.all(
    rides.map(async (ride: any) => {
      const redisQueue = await redis.get(`ride:queue:${ride.id}`);
      const queueCount = Number(redisQueue ?? "0");

      return {
        id: ride.id,
        name: ride.name,
        zone: ride.zone?.name ?? "Unassigned",
        status: ride.status,
        queueCount: Number.isFinite(queueCount) ? queueCount : 0,
      };
    }),
  );

  return NextResponse.json({ items });
}

