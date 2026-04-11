import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { buildDateRange, groupByDate } from "@/lib/reports";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { dateFrom, dateTo } = buildDateRange(
    searchParams.get("dateFrom"),
    searchParams.get("dateTo")
  );

  const assignments = await db.lockerAssignment.findMany({
    where: { assignedAt: { gte: dateFrom, lte: dateTo } },
    include: { locker: { select: { size: true, zone: { select: { name: true } } } } },
  });

  const totalRevenue = assignments.reduce((s, a) => s + Number(a.amount), 0);
  const totalAssignments = assignments.length;

  // Avg duration
  const withReturn = assignments.filter((a) => a.returnedAt);
  const avgDurationMs =
    withReturn.length > 0
      ? withReturn.reduce(
          (s, a) => s + (a.returnedAt!.getTime() - a.assignedAt.getTime()),
          0
        ) / withReturn.length
      : 0;
  const avgDurationHours = Math.round((avgDurationMs / 3_600_000) * 10) / 10;

  // By size
  const bySize = { SMALL: 0, MEDIUM: 0, LARGE: 0 };
  for (const a of assignments) {
    bySize[a.locker.size]++;
  }

  // Daily trend
  const daily = groupByDate(assignments, "assignedAt").map(({ date, items }) => ({
    date,
    assignments: items.length,
    revenue: items.reduce((s, a) => s + Number(a.amount), 0),
    SMALL: items.filter((a) => a.locker.size === "SMALL").length,
    MEDIUM: items.filter((a) => a.locker.size === "MEDIUM").length,
    LARGE: items.filter((a) => a.locker.size === "LARGE").length,
  }));

  // Detailed table
  const rows = assignments.map((a) => ({
    lockerZone: a.locker.zone.name,
    lockerSize: a.locker.size,
    guestName: a.guestName,
    guestMobile: a.guestMobile,
    durationType: a.durationType,
    assignedAt: a.assignedAt.toISOString(),
    returnedAt: a.returnedAt?.toISOString() ?? null,
    amount: Number(a.amount),
    paymentMethod: a.paymentMethod,
  }));

  return NextResponse.json({
    kpi: { totalRevenue, totalAssignments, avgDurationHours, bySize },
    daily,
    rows,
  });
}
