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

  const bookings = await db.booking.findMany({
    where: { createdAt: { gte: dateFrom, lte: dateTo } },
    select: {
      id: true,
      bookingNumber: true,
      status: true,
      adults: true,
      children: true,
      totalAmount: true,
      visitDate: true,
      createdAt: true,
      guestName: true,
      guestMobile: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const total = bookings.length;
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED").length;
  const checkedIn = bookings.filter((b) => b.status === "CHECKED_IN").length;
  const completed = bookings.filter((b) => b.status === "COMPLETED").length;
  const cancelled = bookings.filter((b) => b.status === "CANCELLED").length;
  const pending = bookings.filter((b) => b.status === "PENDING").length;
  const conversionRate =
    total > 0 ? Math.round(((confirmed + checkedIn + completed) / total) * 1000) / 10 : 0;

  const daily = groupByDate(bookings, "createdAt").map(({ date, items }) => ({
    date,
    total: items.length,
    confirmed: items.filter((b) => b.status === "CONFIRMED").length,
    cancelled: items.filter((b) => b.status === "CANCELLED").length,
    revenue: items.reduce((s, b) => s + Number(b.totalAmount), 0),
  }));

  const rows = bookings.map((b) => ({
    bookingNumber: b.bookingNumber,
    guestName: b.guestName ?? "—",
    guestMobile: b.guestMobile ?? "—",
    visitDate: b.visitDate.toISOString().slice(0, 10),
    adults: b.adults,
    children: b.children,
    totalAmount: Number(b.totalAmount),
    status: b.status,
    createdAt: b.createdAt.toISOString().slice(0, 10),
  }));

  return NextResponse.json({
    kpi: { total, confirmed, checkedIn, completed, cancelled, pending, conversionRate },
    daily,
    rows,
  });
}
