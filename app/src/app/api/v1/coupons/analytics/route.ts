import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { error } = await requireAdmin();
  if (error) return error;

  const daysRaw = Number(request.nextUrl.searchParams.get("days") ?? "30");
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, Math.floor(daysRaw))) : 30;
  const fromDate = new Date();
  fromDate.setUTCDate(fromDate.getUTCDate() - days + 1);
  fromDate.setUTCHours(0, 0, 0, 0);

  const [topCoupons, trend] = await Promise.all([
    db.coupon.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        code: true,
        title: true,
        discountType: true,
        currentUses: true,
        usedCount: true,
        redemptions: {
          where: { createdAt: { gte: fromDate } },
          select: { discountAmount: true },
        },
      },
      orderBy: [{ currentUses: "desc" }, { usedCount: "desc" }],
      take: 20,
    }),
    db.couponRedemption.findMany({
      where: { createdAt: { gte: fromDate } },
      select: {
        createdAt: true,
        discountAmount: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const dailyMap = new Map<string, { date: string; count: number; discountAmount: number }>();
  trend.forEach((row) => {
    const date = row.createdAt.toISOString().slice(0, 10);
    const current = dailyMap.get(date) ?? { date, count: 0, discountAmount: 0 };
    current.count += 1;
    current.discountAmount += Number(row.discountAmount);
    dailyMap.set(date, current);
  });

  return NextResponse.json({
    summary: {
      totalCoupons: topCoupons.length,
      totalRedemptions: trend.length,
      totalDiscountGiven: trend.reduce((sum, item) => sum + Number(item.discountAmount), 0),
    },
    topCoupons: topCoupons.map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      title: coupon.title,
      discountType: coupon.discountType,
      currentUses: coupon.currentUses,
      usedCount: coupon.usedCount,
      discountGiven: coupon.redemptions.reduce((sum, item) => sum + Number(item.discountAmount), 0),
    })),
    trend: Array.from(dailyMap.values()).map((item) => ({
      ...item,
      discountAmount: Math.round(item.discountAmount * 100) / 100,
    })),
  });
}
