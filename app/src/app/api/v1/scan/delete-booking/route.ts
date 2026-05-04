/**
 * POST /api/v1/scan/delete-booking
 *
 * Permanent delete for completed bookings from scanner flow.
 * - Booking must be COMPLETED
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
    select: { id: true, bookingNumber: true, status: true, guestName: true },
  });

  if (!booking) {
    return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  }

  if (booking.status !== "COMPLETED") {
    return NextResponse.json({ message: "Only checked-out (COMPLETED) bookings can be deleted" }, { status: 409 });
  }

  await db.$transaction(async (tx) => {
    await tx.couponRedemption.deleteMany({ where: { bookingId: booking.id } });
    await tx.rideAccessLog.deleteMany({ where: { bookingId: booking.id } });
    await tx.foodOrder.deleteMany({ where: { bookingId: booking.id } });
    await tx.lockerAssignment.deleteMany({ where: { bookingId: booking.id } });
    await tx.costumeRental.deleteMany({ where: { bookingId: booking.id } });
    await tx.transaction.deleteMany({ where: { bookingId: booking.id } });
    await tx.bookingTicket.deleteMany({ where: { bookingId: booking.id } });
    await tx.bookingParticipant.deleteMany({ where: { bookingId: booking.id } });
    await tx.booking.delete({ where: { id: booking.id } });
  });

  return NextResponse.json({
    success: true,
    message: "Booking deleted permanently",
    deletedBy: user?.name ?? "Staff",
    booking: {
      bookingNumber: booking.bookingNumber,
      guestName: booking.guestName,
    },
  });
}

