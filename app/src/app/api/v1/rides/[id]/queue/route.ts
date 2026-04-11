import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { calcWaitTimeMinutes, getQueueCount, getSessionUser, requireAdminOrEmployee, updateQueueCount } from "@/lib/rides";

const queuePayloadSchema = z.object({
  action: z.enum(["INCREMENT", "DECREMENT", "SET", "RESET"]),
  value: z.number().int().min(0).max(5000).optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const { id } = await Promise.resolve(context.params);

  const ride = await db.ride.findUnique({ where: { id }, select: { id: true, durationMin: true, isDeleted: true } });
  if (!ride || ride.isDeleted) {
    return NextResponse.json({ message: "Ride not found" }, { status: 404 });
  }

  const queueCount = await getQueueCount(ride.id);
  return NextResponse.json({
    rideId: ride.id,
    queueCount,
    waitTimeMin: calcWaitTimeMinutes(queueCount, ride.durationMin),
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdminOrEmployee(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);
  const ride = await db.ride.findUnique({ where: { id }, select: { id: true, durationMin: true, isDeleted: true } });
  if (!ride || ride.isDeleted) {
    return NextResponse.json({ message: "Ride not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = queuePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const nextCount = await updateQueueCount(ride.id, parsed.data.action, parsed.data.value);

  return NextResponse.json({
    rideId: ride.id,
    queueCount: nextCount,
    waitTimeMin: calcWaitTimeMinutes(nextCount, ride.durationMin),
  });
}
