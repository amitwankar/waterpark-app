import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth } from "date-fns";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

/**
 * GET /api/v1/staff/performance
 * Returns attendance summary per staff member for a given month.
 * Query params: month=YYYY-MM (default: current month), staffUserId
 */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const staffUserId = searchParams.get("staffUserId");

  const monthDate = new Date(`${monthParam}-01`);
  const from = startOfMonth(monthDate);
  const to = endOfMonth(monthDate);

  const shifts = await db.shift.findMany({
    where: {
      shiftDate: { gte: from, lte: to },
      ...(staffUserId ? { staff: { userId: staffUserId } } : {}),
    },
    include: {
      staff: {
        include: {
          user: { select: { id: true, name: true, subRole: true } },
        },
      },
    },
  });

  // Aggregate per staff member
  const summaryMap = new Map<
    string,
    {
      userId: string;
      name: string;
      subRole: string | null;
      totalShifts: number;
      presentDays: number;
      totalHours: number;
    }
  >();

  for (const shift of shifts) {
    const userId = shift.staff.userId;
    if (!summaryMap.has(userId)) {
      summaryMap.set(userId, {
        userId,
        name: shift.staff.user.name,
        subRole: shift.staff.user.subRole,
        totalShifts: 0,
        presentDays: 0,
        totalHours: 0,
      });
    }

    const entry = summaryMap.get(userId)!;
    entry.totalShifts++;
    if (shift.isPresent) {
      entry.presentDays++;
      if (shift.endTime) {
        const hours =
          (shift.endTime.getTime() - shift.startTime.getTime()) / 3_600_000;
        entry.totalHours += Math.round(hours * 100) / 100;
      }
    }
  }

  return NextResponse.json({
    month: monthParam,
    summary: Array.from(summaryMap.values()),
  });
}
