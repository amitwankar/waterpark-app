import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { parseDateOnlyToUtc, sanitizeGuestName, sanitizeMobile, sanitizeOptionalEmail } from "@/lib/booking";
import { db } from "@/lib/db";
import { maskIdProof, maskUpiRef } from "@/lib/encryption";

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

function getUser(session: unknown): { id: string; mobile?: string } | null {
  const candidate = session as { user?: { id?: string; mobile?: string } };
  if (!candidate?.user?.id) {
    return null;
  }
  return {
    id: candidate.user.id,
    mobile: candidate.user.mobile,
  };
}

const bookingUpdateSchema = z.object({
  guestName: z.string().trim().min(2).max(100).optional(),
  guestMobile: z.string().trim().regex(/^[6-9]\d{9}$/).optional(),
  guestEmail: z.string().trim().email().max(255).optional().or(z.literal("")),
  visitDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const params = await Promise.resolve(context.params);
  const id = params.id;
  const byBookingNumber = request.nextUrl.searchParams.get("by") === "bookingNumber";
  const isPublic = request.nextUrl.searchParams.get("public") === "1";

  const booking = await db.booking.findFirst({
    where: byBookingNumber ? { bookingNumber: id } : { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
          subRole: true,
        },
      },
      bookingTickets: {
        include: {
          ticketType: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      },
      participants: {
        include: {
          ticketType: {
            select: {
              id: true,
              name: true,
              minAge: true,
              maxAge: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      transactions: {
        orderBy: { createdAt: "desc" },
      },
      coupon: {
        select: {
          id: true,
          code: true,
          discountType: true,
          discountValue: true,
        },
      },
    },
  });

  if (!booking) {
    return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  }

  if (!isPublic) {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    const user = getUser(session);
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const role = getRole(session);
    if (role !== "ADMIN" && role !== "EMPLOYEE") {
      const ownsBooking = booking.userId === user.id || (user.mobile ? booking.guestMobile === user.mobile : false);
      if (!ownsBooking) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
    } else if (role === "EMPLOYEE") {
      const ownsBooking = booking.userId === user.id;
      if (!ownsBooking) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
    }
  }

  return NextResponse.json({
    booking: {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      userId: booking.userId,
      bookedBy: booking.user
        ? {
            id: booking.user.id,
            name: booking.user.name,
            role: booking.user.role,
            subRole: booking.user.subRole,
          }
        : null,
      guestName: booking.guestName,
      guestMobile: booking.guestMobile,
      guestEmail: booking.guestEmail,
      visitDate: booking.visitDate,
      adults: booking.adults,
      children: booking.children,
      idProofType: booking.idProofType,
      idProofLabel: booking.idProofLabel,
      idProofMasked: booking.idProofNumber ? `${booking.idProofType ?? "ID"} ${maskIdProof(booking.idProofNumber)}` : null,
      subtotal: Number(booking.subtotal),
      gstAmount: Number(booking.gstAmount),
      discountAmount: Number(booking.discountAmount),
      totalAmount: Number(booking.totalAmount),
      status: booking.status,
      checkedInAt: booking.checkedInAt,
      qrCode: booking.qrCode,
      notes: booking.notes,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      coupon: booking.coupon
        ? {
            ...booking.coupon,
            discountValue: Number(booking.coupon.discountValue),
          }
        : null,
      bookingTickets: booking.bookingTickets.map((line: any) => ({
        ...line,
        unitPrice: Number(line.unitPrice),
        gstRate: Number(line.gstRate),
        totalPrice: Number(line.totalPrice),
      })),
      participants: booking.participants.map((participant: any) => ({
        id: participant.id,
        name: participant.name,
        gender: participant.gender,
        age: participant.age,
        isLeadGuest: participant.isLeadGuest,
        ticketTypeId: participant.ticketTypeId,
        ticketType: participant.ticketType,
        ageValidationWarning:
          participant.age !== null &&
          ((participant.ticketType.minAge !== null && participant.age < participant.ticketType.minAge) ||
            (participant.ticketType.maxAge !== null && participant.age > participant.ticketType.maxAge))
            ? `Age ${participant.age} is outside ${participant.ticketType.name} allowed range`
            : null,
      })),
      transactions: booking.transactions.map((line: any) => ({
        id: line.id,
        bookingId: line.bookingId,
        posSessionId: line.posSessionId,
        amount: Number(line.amount),
        method: line.method,
        status: line.status,
        gatewayRef: line.gatewayRef,
        upiRefMasked: maskUpiRef(line.upiRef),
        upiScreenshot: line.upiScreenshot,
        verifiedById: line.verifiedById,
        verifiedAt: line.verifiedAt,
        notes: line.notes,
        createdAt: line.createdAt,
        updatedAt: line.updatedAt,
      })),
    },
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const params = await Promise.resolve(context.params);
  const id = params.id;
  const session = await auth.api.getSession({ headers: request.headers });
  const user = getUser(session);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const role = getRole(session);
  if (role !== "ADMIN" && role !== "EMPLOYEE") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const existing = await db.booking.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true },
  });
  if (!existing) return NextResponse.json({ message: "Booking not found" }, { status: 404 });

  if (role === "EMPLOYEE" && existing.userId !== user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const parsed = bookingUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const payload = parsed.data;
  const updateData: Record<string, unknown> = {};
  if (payload.guestName !== undefined) updateData.guestName = sanitizeGuestName(payload.guestName);
  if (payload.guestMobile !== undefined) updateData.guestMobile = sanitizeMobile(payload.guestMobile);
  if (payload.guestEmail !== undefined) updateData.guestEmail = sanitizeOptionalEmail(payload.guestEmail);
  if (payload.notes !== undefined) updateData.notes = payload.notes.trim() ? payload.notes.trim() : null;
  if (payload.visitDate !== undefined) {
    const parsedVisitDate = parseDateOnlyToUtc(payload.visitDate);
    if (!parsedVisitDate) return NextResponse.json({ message: "Invalid visit date" }, { status: 400 });
    updateData.visitDate = parsedVisitDate;
  }

  const updated = await db.booking.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      bookingNumber: true,
      guestName: true,
      guestMobile: true,
      guestEmail: true,
      visitDate: true,
      notes: true,
      status: true,
    },
  });

  return NextResponse.json({ booking: updated });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const params = await Promise.resolve(context.params);
  const id = params.id;
  const session = await auth.api.getSession({ headers: request.headers });
  const user = getUser(session);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const role = getRole(session);
  if (role !== "ADMIN" && role !== "EMPLOYEE") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const booking = await db.booking.findUnique({
    where: { id },
    select: { id: true, status: true, userId: true },
  });
  if (!booking) return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  if (role === "EMPLOYEE" && booking.userId !== user.id) {
    return NextResponse.json({ message: "You can only delete your own cancelled bookings" }, { status: 403 });
  }
  if (booking.status !== "CANCELLED") {
    return NextResponse.json({ message: "Only cancelled bookings can be deleted" }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    await tx.couponRedemption.deleteMany({ where: { bookingId: id } });
    await tx.rideAccessLog.deleteMany({ where: { bookingId: id } });
    await tx.foodOrder.deleteMany({ where: { bookingId: id } });
    await tx.lockerAssignment.deleteMany({ where: { bookingId: id } });
    await tx.costumeRental.deleteMany({ where: { bookingId: id } });
    await tx.transaction.deleteMany({ where: { bookingId: id } });
    await tx.bookingTicket.deleteMany({ where: { bookingId: id } });
    await tx.bookingParticipant.deleteMany({ where: { bookingId: id } });
    await tx.booking.delete({ where: { id } });
  });

  return NextResponse.json({ success: true });
}
