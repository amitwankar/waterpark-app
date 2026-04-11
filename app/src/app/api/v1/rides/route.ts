import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { calcWaitTimeMinutes, getSessionUser, listRideQueueSnapshot, randomImageSeed, requireAdminOrEmployee } from "@/lib/rides";

const UNLIMITED_CAPACITY_SENTINEL = 999_999;
const n = () => z.coerce.number().finite();

const createRideSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  zoneId: z.string().min(1),
  entryFee: n().min(0).max(50000).default(0),
  gstRate: n().min(0).max(100).default(18),
  minHeight: n().int().min(0).max(250).optional().nullable(),
  maxWeight: n().int().min(0).max(250).optional().nullable(),
  durationMin: n().int().min(1).max(60),
  capacity: n().int().min(1).max(UNLIMITED_CAPACITY_SENTINEL),
  status: z.enum(["ACTIVE", "MAINTENANCE", "CLOSED", "SEASONAL"]).optional(),
  imageUrl: z.string().url().optional().nullable(),
  operatorId: z.string().min(1).optional().nullable(),
  sortOrder: n().int().min(0).max(999).optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const zoneId = request.nextUrl.searchParams.get("zoneId") ?? undefined;
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const includeDeleted = request.nextUrl.searchParams.get("includeDeleted") === "1";

  const rides = await db.ride.findMany({
    where: {
      ...(zoneId ? { zoneId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(includeDeleted ? {} : { isDeleted: false }),
    },
    include: {
      zone: { select: { id: true, name: true } },
      operator: { select: { id: true, name: true, mobile: true } },
      _count: { select: { rideAccessLogs: true, workOrders: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const queueMap = await listRideQueueSnapshot(rides.map((ride: any) => ride.id));

  return NextResponse.json({
    items: rides.map((ride: any) => {
      const queueCount = queueMap[ride.id] ?? 0;
      return {
        ...ride,
        entryFee: Number(ride.entryFee),
        gstRate: Number(ride.gstRate),
        isUnlimitedCapacity: Number(ride.capacity) >= UNLIMITED_CAPACITY_SENTINEL,
        queueCount,
        waitTimeMin: calcWaitTimeMinutes(queueCount, ride.durationMin),
      };
    }),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdminOrEmployee(user) || user?.role !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createRideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const zone = await db.zone.findUnique({ where: { id: parsed.data.zoneId } });
  if (!zone) {
    return NextResponse.json({ message: "Zone not found" }, { status: 404 });
  }

  const created = await db.ride.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      zoneId: parsed.data.zoneId,
      entryFee: parsed.data.entryFee,
      gstRate: parsed.data.gstRate,
      minHeight: parsed.data.minHeight ?? null,
      maxWeight: parsed.data.maxWeight ?? null,
      durationMin: parsed.data.durationMin,
      capacity: parsed.data.capacity,
      status: (parsed.data.status ?? "ACTIVE") as any,
      imageUrl: parsed.data.imageUrl ?? randomImageSeed(parsed.data.name.replace(/\s+/g, "-")),
      operatorId: parsed.data.operatorId ?? null,
      sortOrder: parsed.data.sortOrder ?? 0,
      isDeleted: false,
    },
    include: {
      zone: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ ride: created }, { status: 201 });
}
