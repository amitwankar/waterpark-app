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

  const [transactions, profiles] = await Promise.all([
    db.loyaltyTransaction.findMany({
      where: { createdAt: { gte: dateFrom, lte: dateTo } },
      select: {
        points: true,
        type: true,
        createdAt: true,
      },
    }),
    db.guestProfile.findMany({
      select: { tier: true, loyaltyPoints: true },
    }),
  ]);

  const issued = transactions
    .filter((t) => t.type === "EARN")
    .reduce((s, t) => s + t.points, 0);

  const redeemed = transactions
    .filter((t) => t.type === "REDEEM")
    .reduce((s, t) => s + t.points, 0);

  const expired = transactions
    .filter((t) => t.type === "EXPIRE")
    .reduce((s, t) => s + t.points, 0);

  const activeMembers = profiles.filter((p) => p.loyaltyPoints > 0).length;

  // Tier breakdown
  const tierMap = new Map<string, number>();
  for (const p of profiles) {
    const tier = p.tier ?? "NONE";
    tierMap.set(tier, (tierMap.get(tier) ?? 0) + 1);
  }

  // Monthly trend (issued vs redeemed)
  const monthly = new Map<
    string,
    { month: string; issued: number; redeemed: number }
  >();
  for (const tx of transactions) {
    const month = tx.createdAt.toISOString().slice(0, 7); // "2024-01"
    const entry = monthly.get(month) ?? { month, issued: 0, redeemed: 0 };
    if (tx.type === "EARN") entry.issued += tx.points;
    if (tx.type === "REDEEM") entry.redeemed += tx.points;
    monthly.set(month, entry);
  }

  return NextResponse.json({
    kpi: { issued, redeemed, expired, activeMembers },
    tierBreakdown: Array.from(tierMap.entries()).map(([tier, count]) => ({ tier, count })),
    monthlyTrend: Array.from(monthly.values()).sort((a, b) => a.month.localeCompare(b.month)),
  });
}
