import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  const role = getRole(session);

  if (role !== "ADMIN" && role !== "EMPLOYEE") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const params = await Promise.resolve(context.params);
  const id = params.id;

  const booking = await db.booking.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      visitDate: true,
      checkedInAt: true,
    },
  });

  if (!booking) {
    return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  }

  if (booking.status !== "CONFIRMED") {
    return NextResponse.json({ message: "Only CONFIRMED bookings can be checked in" }, { status: 409 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const bookingDate = booking.visitDate.toISOString().slice(0, 10);
  if (bookingDate !== today) {
    return NextResponse.json({ message: "Check-in is allowed only on visit date" }, { status: 409 });
  }

  const updated = await db.booking.update({
    where: { id },
    data: {
      status: "CHECKED_IN",
      checkedInAt: new Date(),
    },
    select: {
      id: true,
      bookingNumber: true,
      status: true,
      checkedInAt: true,
    },
  });

  return NextResponse.json({ booking: updated });
}

