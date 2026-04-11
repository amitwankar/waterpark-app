import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { maskUpiRef } from "@/lib/encryption";

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  const role = getRole(session);
  if (role !== "ADMIN" && role !== "EMPLOYEE") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);

  const profile = await db.guestProfile.findUnique({ where: { id }, select: { mobile: true } });
  if (!profile) {
    return NextResponse.json({ message: "Guest not found" }, { status: 404 });
  }

  const bookings = await db.booking.findMany({
    where: { guestMobile: profile.mobile },
    include: {
      bookingTickets: {
        include: {
          ticketType: { select: { name: true } },
        },
      },
      transactions: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    items: bookings.map((booking: any) => ({
      ...booking,
      subtotal: Number(booking.subtotal),
      gstAmount: Number(booking.gstAmount),
      discountAmount: Number(booking.discountAmount),
      totalAmount: Number(booking.totalAmount),
      bookingTickets: booking.bookingTickets.map((line: any) => ({
        ...line,
        unitPrice: Number(line.unitPrice),
        gstRate: Number(line.gstRate),
        totalPrice: Number(line.totalPrice),
      })),
      transactions: booking.transactions.map((tx: any) => ({
        id: tx.id,
        bookingId: tx.bookingId,
        posSessionId: tx.posSessionId,
        amount: Number(tx.amount),
        method: tx.method,
        status: tx.status,
        gatewayRef: tx.gatewayRef,
        upiRefMasked: maskUpiRef(tx.upiRef),
        upiScreenshot: tx.upiScreenshot,
        verifiedById: tx.verifiedById,
        verifiedAt: tx.verifiedAt,
        notes: tx.notes,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      })),
    })),
  });
}
