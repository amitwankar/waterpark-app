/**
 * POST /api/v1/scan/checkout
 *
 * Checkout verification — marks booking as COMPLETED.
 * - Booking must be CHECKED_IN
 * - Idempotent for COMPLETED
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { autoCheckoutExpiredCheckedInBookings } from "@/lib/booking-lifecycle";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/session";

const schema = z.object({
  bookingNumber: z.string().trim().min(1),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, error } = await requireStaff();
  if (error) return error;

  await autoCheckoutExpiredCheckedInBookings();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "bookingNumber is required" }, { status: 400 });
  }

  const { bookingNumber } = parsed.data;
  const booking = await (db as any).booking.findFirst({
    where: { bookingNumber },
    select: {
      id: true,
      bookingNumber: true,
      guestName: true,
      status: true,
      visitDate: true,
      checkedInAt: true,
    },
  });

  if (!booking) {
    return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  }

  if (booking.status === "CANCELLED") {
    return NextResponse.json({ message: "Cancelled booking cannot be checked out", code: "CANCELLED" }, { status: 409 });
  }

  if (booking.status === "PENDING" || booking.status === "CONFIRMED") {
    return NextResponse.json({ message: "Guest is not checked in yet", code: "NOT_CHECKED_IN" }, { status: 409 });
  }

  if (booking.status === "COMPLETED") {
    return NextResponse.json({
      success: true,
      alreadyCompleted: true,
      message: "Guest already checked out",
      booking: {
        bookingNumber: booking.bookingNumber,
        guestName: booking.guestName,
        status: booking.status,
      },
    });
  }

  const updated = await (db as any).booking.update({
    where: { id: booking.id },
    data: {
      status: "COMPLETED",
    },
    select: {
      bookingNumber: true,
      guestName: true,
      status: true,
    },
  });

  return NextResponse.json({
    success: true,
    message: "Checkout completed",
    booking: updated,
    checkedOutBy: user!.name,
  });
}

