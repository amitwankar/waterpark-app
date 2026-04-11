/**
 * POST /api/v1/scan/gate
 *
 * Gate entry verification — marks booking as CHECKED_IN.
 * - Valid for today's date only
 * - Booking must be CONFIRMED (or already CHECKED_IN for re-scan info)
 * - Idempotent: if already CHECKED_IN, returns success with re-entry flag
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireStaff } from "@/lib/session";

const schema = z.object({
  bookingNumber: z.string().trim().min(1),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, error } = await requireStaff();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "bookingNumber is required" }, { status: 400 });
  }

  const { bookingNumber } = parsed.data;

  const booking = await db.booking.findFirst({
    where: { bookingNumber },
    select: {
      id: true,
      bookingNumber: true,
      guestName: true,
      guestMobile: true,
      visitDate: true,
      status: true,
      checkedInAt: true,
      totalAmount: true,
      bookingTickets: {
        select: {
          quantity: true,
          ticketType: { select: { name: true } },
        },
      },
    },
  });

  if (!booking) {
    return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  }

  // Validate date
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const visitDate = new Date(booking.visitDate);
  visitDate.setUTCHours(0, 0, 0, 0);

  if (visitDate.getTime() !== today.getTime()) {
    return NextResponse.json(
      {
        message: `Ticket is for ${visitDate.toLocaleDateString("en-IN")} — not valid today`,
        code: "WRONG_DATE",
      },
      { status: 409 },
    );
  }

  if (booking.status === "CANCELLED") {
    return NextResponse.json({ message: "This booking has been cancelled", code: "CANCELLED" }, { status: 409 });
  }

  if (booking.status === "PENDING") {
    return NextResponse.json(
      { message: "Payment is pending for this booking — cannot allow entry", code: "PENDING_PAYMENT" },
      { status: 409 },
    );
  }

  // Already checked in — idempotent success
  if (booking.status === "CHECKED_IN" || booking.status === "COMPLETED") {
    return NextResponse.json({
      success: true,
      reEntry: true,
      message: `Already checked in at ${booking.checkedInAt ? new Date(booking.checkedInAt).toLocaleTimeString("en-IN") : "—"}`,
      booking: {
        bookingNumber: booking.bookingNumber,
        guestName: booking.guestName,
        status: booking.status,
      },
    });
  }

  // Mark as CHECKED_IN
  const updated = await db.booking.update({
    where: { id: booking.id },
    data: {
      status: "CHECKED_IN",
      checkedInAt: new Date(),
    },
    select: {
      bookingNumber: true,
      guestName: true,
      status: true,
      checkedInAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    reEntry: false,
    message: "Entry granted",
    booking: updated,
    scannedBy: user!.name,
  });
}
