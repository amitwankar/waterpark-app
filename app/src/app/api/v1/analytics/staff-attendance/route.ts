import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { buildDateRange } from "@/lib/reports";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { dateFrom, dateTo } = buildDateRange(
    searchParams.get("dateFrom"),
    searchParams.get("dateTo")
  );

  const shifts = await db.shift.findMany({
    where: { shiftDate: { gte: dateFrom, lte: dateTo } },
    include: {
      staff: {
        include: { user: { select: { id: true, name: true, subRole: true } } },
      },
    },
    orderBy: { shiftDate: "asc" },
  });

  const totalStaff = await db.user.count({
    where: { role: "EMPLOYEE", isActive: true },
  });

  const present = shifts.filter((s) => s.isPresent).length;
  const total = shifts.length;

  // Avg hours/day from shifts with endTime
  const withEnd = shifts.filter((s) => s.endTime && s.isPresent);
  const totalHours = withEnd.reduce(
    (sum, s) => sum + (s.endTime!.getTime() - s.startTime.getTime()) / 3_600_000,
    0
  );
  const avgHoursPerDay = withEnd.length > 0 ? Math.round((totalHours / withEnd.length) * 10) / 10 : 0;

  // Calendar heatmap: date → { present, absent, total }
  const heatmap = new Map<
    string,
    { date: string; present: number; absent: number; total: number }
  >();
  for (const shift of shifts) {
    const key = shift.shiftDate.toISOString().slice(0, 10);
    const entry = heatmap.get(key) ?? { date: key, present: 0, absent: 0, total: 0 };
    entry.total++;
    if (shift.isPresent) entry.present++;
    else entry.absent++;
    heatmap.set(key, entry);
  }

  // Staff summary
  const staffMap = new Map<
    string,
    { name: string; subRole: string | null; present: number; total: number; hours: number }
  >();
  for (const shift of shifts) {
    const uid = shift.staff.userId;
    const entry = staffMap.get(uid) ?? {
      name: shift.staff.user.name,
      subRole: shift.staff.user.subRole,
      present: 0,
      total: 0,
      hours: 0,
    };
    entry.total++;
    if (shift.isPresent) {
      entry.present++;
      if (shift.endTime) {
        entry.hours += (shift.endTime.getTime() - shift.startTime.getTime()) / 3_600_000;
      }
    }
    staffMap.set(uid, entry);
  }

  return NextResponse.json({
    kpi: {
      totalStaff,
      presentShifts: present,
      absentShifts: total - present,
      avgHoursPerDay,
    },
    heatmap: Array.from(heatmap.values()),
    staffSummary: Array.from(staffMap.entries()).map(([id, v]) => ({ id, ...v })),
  });
}
