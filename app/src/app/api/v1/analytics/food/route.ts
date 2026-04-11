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

  const orders = await db.foodOrder.findMany({
    where: {
      createdAt: { gte: dateFrom, lte: dateTo },
      status: { not: "CANCELLED" },
    },
    include: {
      outlet: { select: { id: true, name: true } },
      orderItems: true,
    },
  });

  const totalRevenue = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const preBookOrders = orders.filter((o) => o.bookingId !== null);
  const walkInOrders = orders.filter((o) => o.bookingId === null);

  // Revenue per outlet
  const outletMap = new Map<string, { name: string; revenue: number; orders: number }>();
  for (const order of orders) {
    const key = order.outletId;
    const entry = outletMap.get(key) ?? { name: order.outlet.name, revenue: 0, orders: 0 };
    entry.revenue += Number(order.totalAmount);
    entry.orders++;
    outletMap.set(key, entry);
  }

  // Top 10 items
  const itemMap = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const order of orders) {
    for (const item of order.orderItems) {
      const entry = itemMap.get(item.foodItemId) ?? { name: item.name, qty: 0, revenue: 0 };
      entry.qty += item.quantity;
      entry.revenue += Number(item.totalPrice);
      itemMap.set(item.foodItemId, entry);
    }
  }
  const topItems = Array.from(itemMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Daily trend
  const daily = groupByDate(orders, "createdAt").map(({ date, items }) => ({
    date,
    orders: items.length,
    revenue: items.reduce((s, o) => s + Number(o.totalAmount), 0),
  }));

  return NextResponse.json({
    kpi: {
      totalRevenue,
      totalOrders,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      preBookOrders: preBookOrders.length,
      walkInOrders: walkInOrders.length,
    },
    byOutlet: Array.from(outletMap.values()),
    topItems,
    daily,
  });
}
