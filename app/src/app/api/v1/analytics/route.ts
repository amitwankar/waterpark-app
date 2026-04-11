import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const [totalBookings, totalRevenue, totalGuests, totalLeads] = await Promise.all([
    db.booking.count(),
    db.transaction.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
    db.guestProfile.count(),
    db.lead.count(),
  ]);

  return NextResponse.json({
    totalBookings,
    totalRevenue: Number(totalRevenue._sum.amount ?? 0),
    totalGuests,
    totalLeads,
  });
}
