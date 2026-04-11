import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from")
    ? new Date(searchParams.get("from")!)
    : new Date(Date.now() - 30 * 86400000);
  const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : new Date();
  to.setHours(23, 59, 59, 999);

  const [rentals, topItems, statusCounts] = await Promise.all([
    // Daily rentals
    db.costumeRental.groupBy({
      by: ["rentedAt"],
      where: { rentedAt: { gte: from, lte: to } },
      _count: { id: true },
      _sum: { rentalAmount: true, depositAmount: true },
    }),
    // Top rented categories
    db.costumeRental.groupBy({
      by: ["costumeItemId"],
      where: { rentedAt: { gte: from, lte: to } },
      _count: { id: true },
      _sum: { rentalAmount: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    // Current inventory status
    db.costumeItem.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
  ]);

  // Build daily series
  const dailyMap = new Map<string, { count: number; revenue: number; deposits: number }>();
  for (const row of rentals) {
    const day = row.rentedAt.toISOString().slice(0, 10);
    const existing = dailyMap.get(day) ?? { count: 0, revenue: 0, deposits: 0 };
    existing.count += row._count.id;
    existing.revenue += Number(row._sum.rentalAmount ?? 0);
    existing.deposits += Number(row._sum.depositAmount ?? 0);
    dailyMap.set(day, existing);
  }
  const series = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  // Enrich top items with name
  const enrichedTop = await Promise.all(
    topItems.map(async (row) => {
      const item = await db.costumeItem.findUnique({
        where: { id: row.costumeItemId },
        include: { category: { select: { name: true } } },
      });
      return {
        itemId: row.costumeItemId,
        name: item?.name ?? "Unknown",
        category: item?.category.name ?? "–",
        count: row._count.id,
        revenue: Number(row._sum.rentalAmount ?? 0),
      };
    })
  );

  const totalRentals = series.reduce((s, d) => s + d.count, 0);
  const totalRevenue = series.reduce((s, d) => s + d.revenue, 0);
  const totalDeposits = series.reduce((s, d) => s + d.deposits, 0);
  const activeRentals = (await db.costumeRental.count({ where: { returnedAt: null } }));

  const inventory: Record<string, number> = {};
  for (const row of statusCounts) {
    inventory[row.status] = row._count.id;
  }

  return NextResponse.json({
    kpi: { totalRentals, totalRevenue, totalDeposits, activeRentals, inventory },
    series,
    topItems: enrichedTop,
  });
}
