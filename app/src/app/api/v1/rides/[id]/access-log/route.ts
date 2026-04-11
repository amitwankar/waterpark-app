import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { withRequestContext } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { decrementQueueBy, getSessionUser, requireAdminOrEmployee } from "@/lib/rides";

const createAccessLogSchema = z.object({
  bookingNumber: z.string().trim().min(3).max(100).optional(),
  qrCode: z.string().trim().min(8).max(200).optional(),
  nonce: z.string().trim().min(8).max(120).optional(),
  guestCount: z.number().int().min(1).max(20).default(1),
  notes: z.string().trim().max(500).optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const requestLogger = withRequestContext({
    requestId: request.headers.get("x-request-id") ?? undefined,
    method: request.method,
    path: request.nextUrl.pathname,
  });
  const { id } = await Promise.resolve(context.params);

  const ride = await db.ride.findUnique({ where: { id }, select: { id: true, isDeleted: true } });
  if (!ride || ride.isDeleted) {
    requestLogger.warn({ rideId: id }, "Ride access-log GET rejected: ride not found");
    return NextResponse.json({ message: "Ride not found" }, { status: 404 });
  }

  const logs = await db.rideAccessLog.findMany({
    where: { rideId: ride.id },
    include: {
      booking: {
        select: {
          bookingNumber: true,
          guestName: true,
          guestMobile: true,
          visitDate: true,
          status: true,
        },
      },
      ride: { select: { id: true, name: true } },
    },
    orderBy: { scannedAt: "desc" },
    take: 200,
  });

  const hourlyMap = new Map<string, number>();
  for (const log of logs) {
    const h = `${String(log.scannedAt.getHours()).padStart(2, "0")}:00`;
    hourlyMap.set(h, (hourlyMap.get(h) ?? 0) + 1);
  }

  requestLogger.info({ rideId: id, count: logs.length }, "Ride access-log GET completed");
  return NextResponse.json({
    items: logs,
    hourly: Array.from(hourlyMap.entries()).map(([hour, count]) => ({ hour, count })),
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  const requestLogger = withRequestContext({
    requestId: request.headers.get("x-request-id") ?? undefined,
    userId: user?.id,
    method: request.method,
    path: request.nextUrl.pathname,
  });
  if (!requireAdminOrEmployee(user)) {
    requestLogger.warn("Ride access-log POST rejected: forbidden");
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);

  const ride = await db.ride.findUnique({ where: { id }, select: { id: true, isDeleted: true } });
  if (!ride || ride.isDeleted) {
    requestLogger.warn({ rideId: id }, "Ride access-log POST rejected: ride not found");
    return NextResponse.json({ message: "Ride not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createAccessLogSchema.safeParse(body);
  if (!parsed.success) {
    requestLogger.warn({ issues: parsed.error.issues.length }, "Ride access-log POST rejected: invalid payload");
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }
  if (!parsed.data.bookingNumber && !parsed.data.qrCode) {
    requestLogger.warn("Ride access-log POST rejected: missing bookingNumber/qrCode");
    return NextResponse.json({ message: "bookingNumber or qrCode is required" }, { status: 400 });
  }
  if (parsed.data.qrCode && !parsed.data.nonce) {
    requestLogger.warn("Ride access-log POST rejected: missing nonce for qrCode flow");
    return NextResponse.json({ message: "nonce is required for QR scan verification" }, { status: 400 });
  }

  if (parsed.data.nonce) {
    const antiReplayKey = `ride:scan:nonce:${ride.id}:${parsed.data.nonce}`;
    const seen = await redis.get(antiReplayKey);
    if (seen) {
      requestLogger.warn({ rideId: ride.id }, "Ride access-log POST rejected: duplicate scan nonce");
      return NextResponse.json({ message: "Duplicate scan attempt detected" }, { status: 409 });
    }
    await redis.set(antiReplayKey, "1", "EX", 120);
  }

  const booking = await db.booking.findFirst({
    where: {
      OR: [
        ...(parsed.data.bookingNumber ? [{ bookingNumber: parsed.data.bookingNumber }] : []),
        ...(parsed.data.qrCode ? [{ qrCode: parsed.data.qrCode }] : []),
      ],
      status: { in: ["CONFIRMED", "CHECKED_IN", "COMPLETED"] },
    },
    select: {
      id: true,
      bookingNumber: true,
      bookingTickets: {
        select: {
          quantity: true,
          ticketType: {
            select: {
              rideId: true,
            },
          },
        },
      },
    },
  });

  if (!booking) {
    requestLogger.warn({ rideId: ride.id }, "Ride access-log POST rejected: booking not found/invalid status");
    return NextResponse.json({ message: "Booking not found or invalid status" }, { status: 404 });
  }

  const allowedUses = booking.bookingTickets.reduce((sum, line) => {
    if (line.ticketType.rideId !== ride.id) return sum;
    return sum + line.quantity;
  }, 0);

  if (allowedUses <= 0) {
    requestLogger.warn({ rideId: ride.id, bookingId: booking.id }, "Ride access-log POST rejected: ride not included in booking");
    return NextResponse.json({ message: "This ticket is not valid for the selected ride" }, { status: 409 });
  }

  const usedUses = await db.rideAccessLog.count({
    where: {
      rideId: ride.id,
      bookingId: booking.id,
    },
  });

  const remainingUses = Math.max(0, allowedUses - usedUses);
  if (remainingUses <= 0) {
    requestLogger.warn({ rideId: ride.id, bookingId: booking.id }, "Ride access-log POST rejected: usage limit reached");
    return NextResponse.json(
      { message: "Ride usage limit reached for this booking", allowedUses, usedUses, remainingUses },
      { status: 409 },
    );
  }

  const requestedCount = Math.max(1, parsed.data.guestCount);
  if (requestedCount > remainingUses) {
    requestLogger.warn({ rideId: ride.id, bookingId: booking.id, requestedCount, remainingUses }, "Ride access-log POST rejected: requested count exceeds remaining uses");
    return NextResponse.json(
      {
        message: `Only ${remainingUses} ride entry/entries remaining for this booking`,
        allowedUses,
        usedUses,
        remainingUses,
      },
      { status: 409 },
    );
  }

  const createdLogs = await db.$transaction(async (tx) => {
    const out = [];
    for (let index = 0; index < requestedCount; index += 1) {
      const created = await tx.rideAccessLog.create({
        data: {
          rideId: ride.id,
          bookingId: booking.id,
          scannedBy: user?.id ?? null,
        },
      });
      out.push(created);
    }
    return out;
  });

  await decrementQueueBy(ride.id, requestedCount);
  requestLogger.info(
    {
      rideId: ride.id,
      bookingId: booking.id,
      createdCount: createdLogs.length,
      remainingUses: Math.max(0, remainingUses - requestedCount),
    },
    "Ride access-log POST completed",
  );

  return NextResponse.json(
    {
      verified: true,
      message: "Ticket verified for ride access",
      createdCount: createdLogs.length,
      allowedUses,
      usedUses: usedUses + requestedCount,
      remainingUses: Math.max(0, remainingUses - requestedCount),
      items: createdLogs,
    },
    { status: 201 },
  );
}
