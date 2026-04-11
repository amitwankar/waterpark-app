import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function parseRange(url: URL): { start: Date; end: Date; previousStart: Date; previousEnd: Date } {
  const preset = url.searchParams.get("preset") ?? "today";
  const now = new Date();

  let start = startOfDay(now);
  let end = endOfDay(now);

  if (preset === "week") {
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day - 1));
    start = startOfDay(monday);
    end = endOfDay(now);
  }

  if (preset === "month") {
    start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    end = endOfDay(now);
  }

  if (preset === "custom") {
    const startRaw = url.searchParams.get("start");
    const endRaw = url.searchParams.get("end");
    if (startRaw && endRaw) {
      const customStart = new Date(startRaw);
      const customEnd = new Date(endRaw);
      if (!Number.isNaN(customStart.getTime()) && !Number.isNaN(customEnd.getTime())) {
        start = startOfDay(customStart);
        end = endOfDay(customEnd);
      }
    }
  }

  const duration = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);

  return { start, end, previousStart, previousEnd };
}

async function getLiveGuests(): Promise<number> {
  const liveKey = "park:live:guests";
  const redisValue = await redis.get(liveKey);
  const parsed = Number(redisValue ?? "0");
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }

  const today = new Date().toISOString().slice(0, 10);
  const fallback = await redis.get(`park:capacity:${today}`);
  const fallbackParsed = Number(fallback ?? "0");
  return Number.isFinite(fallbackParsed) ? fallbackParsed : 0;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  const role = getRole(session);
  if (role !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { start, end, previousStart, previousEnd } = parseRange(request.nextUrl);

  const [
    bookingCount,
    previousBookingCount,
    paidAggregate,
    previousPaidAggregate,
    pendingUpi,
    activeRides,
    maintenanceRides,
    openWorkOrders,
    criticalWorkOrders,
    parkConfig,
    liveGuests,
    gatewayRevenue,
    upiRevenue,
    cashRevenue,
  ] = await Promise.all([
    db.booking.count({ where: { createdAt: { gte: start, lte: end } } }),
    db.booking.count({ where: { createdAt: { gte: previousStart, lte: previousEnd } } }),
    db.transaction.aggregate({
      _sum: { amount: true },
      where: { status: "PAID", createdAt: { gte: start, lte: end } },
    }),
    db.transaction.aggregate({
      _sum: { amount: true },
      where: { status: "PAID", createdAt: { gte: previousStart, lte: previousEnd } },
    }),
    db.transaction.count({ where: { method: "MANUAL_UPI", status: "PENDING" } }),
    db.ride.count({ where: { isDeleted: false, status: "ACTIVE" } }),
    db.ride.count({ where: { isDeleted: false, status: "MAINTENANCE" } }),
    db.workOrder.count({ where: { isDeleted: false, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.workOrder.count({
      where: {
        isDeleted: false,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        priority: "CRITICAL",
      },
    }),
    db.parkConfig.findFirst({ select: { maxCapacityPerDay: true } }),
    getLiveGuests(),
    db.transaction.aggregate({
      _sum: { amount: true },
      where: { status: "PAID", method: "GATEWAY", createdAt: { gte: start, lte: end } },
    }),
    db.transaction.aggregate({
      _sum: { amount: true },
      where: { status: "PAID", method: "MANUAL_UPI", createdAt: { gte: start, lte: end } },
    }),
    db.transaction.aggregate({
      _sum: { amount: true },
      where: { status: "PAID", method: "CASH", createdAt: { gte: start, lte: end } },
    }),
  ]);

  const revenue = Number(paidAggregate._sum.amount ?? 0);
  const previousRevenue = Number(previousPaidAggregate._sum.amount ?? 0);

  const bookingTrend = previousBookingCount === 0 ? 100 : ((bookingCount - previousBookingCount) / previousBookingCount) * 100;
  const revenueTrend = previousRevenue === 0 ? 100 : ((revenue - previousRevenue) / previousRevenue) * 100;

  return NextResponse.json({
    range: { start, end },
    kpis: {
      bookings: {
        value: bookingCount,
        trend: Number(bookingTrend.toFixed(1)),
      },
      revenue: {
        value: revenue,
        trend: Number(revenueTrend.toFixed(1)),
        breakdown: {
          gateway: Number(gatewayRevenue._sum.amount ?? 0),
          upi: Number(upiRevenue._sum.amount ?? 0),
          cash: Number(cashRevenue._sum.amount ?? 0),
        },
      },
      guestsInPark: {
        value: liveGuests,
        capacity: parkConfig?.maxCapacityPerDay ?? 2000,
      },
      pendingUpi,
      activeRides: {
        active: activeRides,
        maintenance: maintenanceRides,
      },
      workOrders: {
        open: openWorkOrders,
        critical: criticalWorkOrders,
      },
    },
  });
}
