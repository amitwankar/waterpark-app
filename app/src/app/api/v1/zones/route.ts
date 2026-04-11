import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser, requireAdmin } from "@/lib/rides";

const zoneSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export async function GET(): Promise<NextResponse> {
  const zones = await db.zone.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      rides: {
        where: { isDeleted: false },
        select: { id: true, status: true },
      },
    },
  });

  return NextResponse.json({
    items: zones.map((zone: any) => ({
      ...zone,
      activeRideCount: zone.rides.filter((ride: any) => ride.status === "ACTIVE").length,
      rideCount: zone.rides.length,
    })),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdmin(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = zoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const created = await db.zone.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      isActive: parsed.data.isActive ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });

  return NextResponse.json({ zone: created }, { status: 201 });
}
