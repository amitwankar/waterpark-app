import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const tickets = await db.ticketType.findMany({
    where: {
      isActive: true,
      isDeleted: false,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      gstRate: true,
      minAge: true,
      maxAge: true,
      maxPerBooking: true,
      validDays: true,
    },
  });

  return NextResponse.json(
    {
      tickets: tickets.map((ticket: any) => ({
        ...ticket,
        price: Number(ticket.price),
        gstRate: Number(ticket.gstRate),
      })),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    },
  );
}
