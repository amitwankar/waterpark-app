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

import { autoCheckoutExpiredCheckedInBookings } from "@/lib/booking-lifecycle";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/session";

const schema = z.object({
  bookingNumber: z.string().trim().min(1),
  entryCount: z.coerce.number().int().min(1).max(200).default(1),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, error } = await requireStaff();
  if (error) return error;
  await autoCheckoutExpiredCheckedInBookings();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "bookingNumber and valid entryCount are required" }, { status: 400 });
  }

  const { bookingNumber, entryCount } = parsed.data;

  const booking = await (db as any).booking.findFirst({
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
      adults: true,
      children: true,
      gateEnteredCount: true,
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

  if (booking.status === "COMPLETED") {
    return NextResponse.json({
      success: true,
      reEntry: true,
      message: "Visit already completed",
      booking: {
        bookingNumber: booking.bookingNumber,
        guestName: booking.guestName,
        status: booking.status,
      },
    });
  }

  const allowedFromTickets = booking.bookingTickets.reduce(
    (sum: number, line: { quantity: number }) => sum + Math.max(0, line.quantity),
    0,
  );
  const allowedFromHeadcount = Math.max(0, booking.adults) + Math.max(0, booking.children);
  const allowedCount = Math.max(1, allowedFromTickets, allowedFromHeadcount);
  const enteredCount = Math.max(0, booking.gateEnteredCount ?? 0);
  const remainingCount = Math.max(0, allowedCount - enteredCount);

  if (entryCount > remainingCount) {
    return NextResponse.json(
      {
        message: `Only ${remainingCount} ${remainingCount === 1 ? "person is" : "people are"} remaining for entry`,
        code: "ENTRY_COUNT_EXCEEDED",
        gateUsage: { allowedCount, enteredCount, remainingCount },
      },
      { status: 409 },
    );
  }

  if (remainingCount <= 0) {
    return NextResponse.json({
      success: true,
      reEntry: true,
      message: "All guests for this booking are already marked entered",
      gateUsage: { allowedCount, enteredCount, remainingCount: 0 },
      booking: {
        bookingNumber: booking.bookingNumber,
        guestName: booking.guestName,
        status: booking.status,
      },
    });
  }

  const nextEnteredCount = enteredCount + entryCount;
  const nextRemainingCount = Math.max(0, allowedCount - nextEnteredCount);

  // Mark as CHECKED_IN
  const updated = await (db as any).booking.update({
    where: { id: booking.id },
    data: {
      status: booking.status === "CONFIRMED" ? "CHECKED_IN" : booking.status,
      checkedInAt: booking.checkedInAt ?? new Date(),
      gateEnteredCount: nextEnteredCount,
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
    reEntry: booking.status === "CHECKED_IN",
    message: "Entry granted",
    booking: updated,
    scannedBy: user!.name,
    gateUsage: {
      allowedCount,
      enteredCount: nextEnteredCount,
      remainingCount: nextRemainingCount,
      justEntered: entryCount,
    },
  });
}
