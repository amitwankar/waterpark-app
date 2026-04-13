import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { buildDateRange, groupByDate } from "@/lib/reports";
import { requireAdmin } from "@/lib/session";

interface DailyRow {
  date: string;
  entries: number;
  exits: number;
  revenue: number;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { dateFrom, dateTo } = buildDateRange(
    searchParams.get("dateFrom"),
    searchParams.get("dateTo"),
  );

  const [entries, exits, activeCount] = await Promise.all([
    db.parkingTicket.findMany({
      where: { entryAt: { gte: dateFrom, lte: dateTo } },
      orderBy: { entryAt: "desc" },
      include: {
        rate: true,
        issuedBy: { select: { id: true, name: true } },
      },
    }),
    db.parkingTicket.findMany({
      where: {
        status: "EXITED",
        exitAt: { gte: dateFrom, lte: dateTo },
      },
      orderBy: { exitAt: "desc" },
      include: {
        rate: true,
        issuedBy: { select: { id: true, name: true } },
      },
    }),
    db.parkingTicket.count({ where: { status: "ACTIVE" } }),
  ]);

  const entriesByDate = new Map(
    groupByDate(entries, "entryAt").map(({ date, items }) => [date, items.length]),
  );
  const exitsByDate = new Map(
    groupByDate(exits, "exitAt").map(({ date, items }) => [date, items.length]),
  );
  const revenueByDate = new Map(
    groupByDate(exits, "exitAt").map(({ date, items }) => [
      date,
      items.reduce((sum, item) => sum + Number(item.totalAmount), 0),
    ]),
  );

  const allDates = new Set<string>([
    ...entriesByDate.keys(),
    ...exitsByDate.keys(),
    ...revenueByDate.keys(),
  ]);

  const daily: DailyRow[] = Array.from(allDates)
    .sort((a, b) => a.localeCompare(b))
    .map((date) => ({
      date,
      entries: entriesByDate.get(date) ?? 0,
      exits: exitsByDate.get(date) ?? 0,
      revenue: Math.round((revenueByDate.get(date) ?? 0) * 100) / 100,
    }));

  const vehicleRevenueMap = new Map<string, { vehicleType: string; count: number; revenue: number }>();
  for (const row of exits) {
    const key = row.vehicleType;
    const existing = vehicleRevenueMap.get(key) ?? { vehicleType: key, count: 0, revenue: 0 };
    existing.count += 1;
    existing.revenue += Number(row.totalAmount);
    vehicleRevenueMap.set(key, existing);
  }

  const paymentMap = new Map<string, { method: string; count: number; amount: number }>();
  for (const row of exits) {
    const method = row.paymentMethod ?? "UNPAID";
    const existing = paymentMap.get(method) ?? { method, count: 0, amount: 0 };
    existing.count += 1;
    existing.amount += Number(row.totalAmount);
    paymentMap.set(method, existing);
  }

  const vehicleRevenue = Array.from(vehicleRevenueMap.values())
    .map((row) => ({ ...row, revenue: Math.round(row.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue);

  const paymentSplit = Array.from(paymentMap.values())
    .map((row) => ({ ...row, amount: Math.round(row.amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

  const totalRevenue = exits.reduce((sum, row) => sum + Number(row.totalAmount), 0);

  return NextResponse.json({
    kpi: {
      dailyVehicleCount: entries.length,
      exitedVehicleCount: exits.length,
      activeVehicleCount: activeCount,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
    },
    daily,
    vehicleRevenue,
    paymentSplit,
    rows: exits.slice(0, 200).map((row) => ({
      id: row.id,
      ticketNumber: row.ticketNumber,
      vehicleNumber: row.vehicleNumber,
      vehicleType: row.vehicleType,
      hours: row.hours,
      paymentMethod: row.paymentMethod,
      totalAmount: Math.round(Number(row.totalAmount) * 100) / 100,
      entryAt: row.entryAt,
      exitAt: row.exitAt,
      issuedBy: row.issuedBy.name,
    })),
  });
}
