/**
 * GET /api/v1/scan/lookup?q=<bookingNumber|qrJsonPayload>
 *
 * Returns full booking details for QR scan display — before the operator
 * confirms the action. Supports both plain booking numbers and the JSON
 * payload embedded in the booking QR code.
 */
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireStaff } from "@/lib/session";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { error } = await requireStaff();
  if (error) return error;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ message: "q is required" }, { status: 400 });
  }

  // Support both plain booking number and JSON QR payload
  let bookingNumber = q;
  try {
    const parsed = JSON.parse(q) as { bookingNumber?: string };
    if (parsed.bookingNumber) bookingNumber = parsed.bookingNumber;
  } catch {
    // not JSON — use q as-is
  }

  const booking = await db.booking.findFirst({
    where: { bookingNumber },
    include: {
      bookingTickets: {
        include: {
          ticketType: {
            select: {
              id: true,
              name: true,
              rideId: true,
              minAge: true,
              maxAge: true,
            },
          },
        },
      },
      rideAccessLogs: {
        select: { rideId: true, scannedAt: true },
        orderBy: { scannedAt: "desc" },
      },
    },
  });

  if (!booking) {
    return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const visitDate = new Date(booking.visitDate);
  visitDate.setUTCHours(0, 0, 0, 0);
  const isValidDate = visitDate.getTime() === today.getTime();
  const isValidStatus = ["CONFIRMED", "CHECKED_IN"].includes(booking.status);

  // Build per-ride usage summary
  const rideUsage: Record<string, { used: number; allowed: number; rideName?: string }> = {};
  for (const bt of booking.bookingTickets) {
    const rideId = bt.ticketType.rideId;
    if (!rideId) continue;
    const existing = rideUsage[rideId] ?? { used: 0, allowed: 0 };
    existing.allowed += bt.quantity;
    rideUsage[rideId] = existing;
  }
  for (const log of booking.rideAccessLogs) {
    const entry = rideUsage[log.rideId];
    if (entry) entry.used += 1;
  }

  // Is gate entry already done?
  const gateUsed = booking.status === "CHECKED_IN" || booking.status === "COMPLETED";

  return NextResponse.json({
    booking: {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      guestName: booking.guestName,
      guestMobile: booking.guestMobile,
      visitDate: booking.visitDate,
      status: booking.status,
      totalAmount: Number(booking.totalAmount),
      checkedInAt: booking.checkedInAt,
      tickets: booking.bookingTickets.map((bt) => ({
        id: bt.id,
        ticketTypeName: bt.ticketType.name,
        ticketTypeId: bt.ticketType.id,
        rideId: bt.ticketType.rideId,
        quantity: bt.quantity,
        unitPrice: Number(bt.unitPrice),
      })),
    },
    validity: {
      isValidDate,
      isValidStatus,
      gateUsed,
      canEnterGate: isValidDate && isValidStatus,
    },
    rideUsage,
  });
}
