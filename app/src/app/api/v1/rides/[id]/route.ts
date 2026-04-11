import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { calcWaitTimeMinutes, getQueueCount, getSessionUser, requireAdminOrEmployee } from "@/lib/rides";

const UNLIMITED_CAPACITY_SENTINEL = 999_999;
const n = () => z.coerce.number().finite();

const updateRideSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  zoneId: z.string().min(1).optional(),
  entryFee: n().min(0).max(50000).optional(),
  gstRate: n().min(0).max(100).optional(),
  minHeight: n().int().min(0).max(250).optional().nullable(),
  maxWeight: n().int().min(0).max(250).optional().nullable(),
  durationMin: n().int().min(1).max(60).optional(),
  capacity: n().int().min(1).max(UNLIMITED_CAPACITY_SENTINEL).optional(),
  status: z.enum(["ACTIVE", "MAINTENANCE", "CLOSED", "SEASONAL"]).optional(),
  imageUrl: z.string().url().optional().nullable(),
  operatorId: z.string().min(1).optional().nullable(),
  sortOrder: n().int().min(0).max(999).optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const { id } = await Promise.resolve(context.params);

  const ride = await db.ride.findFirst({
    where: { id, isDeleted: false },
    include: {
      zone: true,
      operator: { select: { id: true, name: true, mobile: true, subRole: true } },
      workOrders: {
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      rideAccessLogs: {
        orderBy: { scannedAt: "desc" },
        take: 50,
        include: {
          booking: { select: { bookingNumber: true, guestName: true, guestMobile: true } },
        },
      },
    },
  });

  if (!ride) {
    return NextResponse.json({ message: "Ride not found" }, { status: 404 });
  }

  const queueCount = await getQueueCount(ride.id);

  return NextResponse.json({
    ride: {
      ...ride,
      entryFee: Number(ride.entryFee),
      gstRate: Number(ride.gstRate),
      isUnlimitedCapacity: Number(ride.capacity) >= UNLIMITED_CAPACITY_SENTINEL,
      queueCount,
      waitTimeMin: calcWaitTimeMinutes(queueCount, ride.durationMin),
    },
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdminOrEmployee(user) || user?.role !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);
  const body = await request.json().catch(() => null);
  const parsed = updateRideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.ride.findUnique({ where: { id } });
  if (!existing || existing.isDeleted) {
    return NextResponse.json({ message: "Ride not found" }, { status: 404 });
  }

  if (parsed.data.zoneId) {
    const zone = await db.zone.findUnique({ where: { id: parsed.data.zoneId } });
    if (!zone) {
      return NextResponse.json({ message: "Zone not found" }, { status: 404 });
    }
  }

  const updated = await db.ride.update({
    where: { id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description ?? null } : {}),
      ...(parsed.data.zoneId ? { zoneId: parsed.data.zoneId } : {}),
      ...(parsed.data.entryFee !== undefined ? { entryFee: parsed.data.entryFee } : {}),
      ...(parsed.data.gstRate !== undefined ? { gstRate: parsed.data.gstRate } : {}),
      ...(parsed.data.minHeight !== undefined ? { minHeight: parsed.data.minHeight ?? null } : {}),
      ...(parsed.data.maxWeight !== undefined ? { maxWeight: parsed.data.maxWeight ?? null } : {}),
      ...(parsed.data.durationMin !== undefined ? { durationMin: parsed.data.durationMin } : {}),
      ...(parsed.data.capacity !== undefined ? { capacity: parsed.data.capacity } : {}),
      ...(parsed.data.status ? { status: parsed.data.status as any } : {}),
      ...(parsed.data.imageUrl !== undefined ? { imageUrl: parsed.data.imageUrl ?? null } : {}),
      ...(parsed.data.operatorId !== undefined ? { operatorId: parsed.data.operatorId ?? null } : {}),
      ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
    },
  });

  return NextResponse.json({ ride: updated });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdminOrEmployee(user) || user?.role !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);

  const ride = await db.ride.findUnique({ where: { id } });
  if (!ride || ride.isDeleted) {
    return NextResponse.json({ message: "Ride not found" }, { status: 404 });
  }

  await db.ride.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      operatorId: null,
      status: "CLOSED" as any,
    },
  });

  return NextResponse.json({ ok: true });
}
