import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  bookingSchema,
  calculatePricing,
  parseDateOnlyToUtc,
  roundMoney,
  sanitizeCouponCode,
  sanitizeGuestName,
  sanitizeMobile,
  sanitizeOptionalEmail,
  type TicketLine,
} from "@/lib/booking";
import { assertCapacityAvailable, incrementCapacity } from "@/lib/capacity";
import { evaluateCoupon } from "@/lib/coupon";
import { db } from "@/lib/db";
import { encrypt, maskIdProof } from "@/lib/encryption";
import { generateBookingQrContent } from "@/lib/qr";
import { incrementQueueBy } from "@/lib/rides";
import { generateBookingNumber } from "@/lib/utils";

const ID_PROOF_TYPES = ["AADHAAR", "DRIVING_LICENSE", "PAN", "PASSPORT", "VOTER_ID", "OTHER"] as const;
const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
const BOOKING_PAYMENT_METHODS = ["GATEWAY", "MANUAL_UPI", "CASH", "CARD"] as const;

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED"]).optional(),
  source: z.enum(["PREBOOKING", "POS"]).optional(),
  search: z.string().trim().max(120).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

const bookingExtrasSchema = z
  .object({
    idProofType: z.enum(ID_PROOF_TYPES).optional(),
    idProofNumber: z.string().trim().max(60).optional().or(z.literal("")),
    idProofLabel: z.string().trim().max(60).optional().or(z.literal("")),
    participants: z
      .array(
        z
          .object({
            name: z.string().trim().max(100).optional(),
            gender: z.enum(GENDERS).optional(),
            age: z.number().int().min(1).max(120).optional(),
            ticketTypeId: z.string().trim().min(1),
            isLeadGuest: z.boolean().optional(),
          })
          .strict(),
      )
      .max(100)
      .optional(),
    paymentPlan: z.enum(["FULL", "ADVANCE"]).optional(),
    advancePercent: z.number().min(1).max(90).optional(),
    paymentMethod: z.enum(BOOKING_PAYMENT_METHODS).optional(),
    paymentReference: z.string().trim().max(120).optional().or(z.literal("")),
  })
  .passthrough();

function sanitizeParticipantName(value: string | undefined, fallback: string): string {
  const next = value?.trim().replace(/\s+/g, " ") ?? "";
  return next.length > 0 ? next.slice(0, 100) : fallback;
}

function sanitizeIdProofNumber(value: string): string {
  return value.trim().replace(/\s+/g, "").slice(0, 60).toUpperCase();
}

function sanitizeIdProofLabel(value?: string): string | null {
  const next = value?.trim().replace(/\s+/g, " ") ?? "";
  return next.length > 0 ? next.slice(0, 60) : null;
}

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

function getSubRole(session: unknown): string | null {
  const candidate = session as { user?: { subRole?: string | null } };
  return candidate?.user?.subRole ?? null;
}

function getUserFromSession(session: unknown): { id: string; mobile?: string } | null {
  const candidate = session as { user?: { id?: string; mobile?: string } };
  if (!candidate?.user?.id) {
    return null;
  }
  return {
    id: candidate.user.id,
    mobile: candidate.user.mobile,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const raw = (await request.json().catch(() => null)) as unknown;
  const baseParsed = bookingSchema.safeParse(raw);
  const extrasParsed = bookingExtrasSchema.safeParse(raw);

  if (!baseParsed.success || !extrasParsed.success) {
    const combinedIssues = [
      ...(baseParsed.success ? [] : baseParsed.error.issues),
      ...(extrasParsed.success ? [] : extrasParsed.error.issues),
    ];
    const firstIssue = combinedIssues[0];
    const firstPath = firstIssue?.path?.length ? firstIssue.path.join(".") : "request";
    const firstMessage = firstIssue ? `${firstPath}: ${firstIssue.message}` : "Validation failed";

    return NextResponse.json(
      {
        message: firstMessage,
        errors: {
          ...(baseParsed.success ? {} : baseParsed.error.flatten().fieldErrors),
          ...(extrasParsed.success ? {} : extrasParsed.error.flatten().fieldErrors),
        },
      },
      { status: 400 },
    );
  }

  const payload = baseParsed.data;
  const extras = extrasParsed.data;
  const visitDate = parseDateOnlyToUtc(payload.visitDate);
  if (!visitDate) {
    return NextResponse.json({ message: "Invalid visit date" }, { status: 400 });
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });
  const sessionUser = getUserFromSession(session);
  const role = getRole(session);
  const subRole = getSubRole(session);

  if (!sessionUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const canCreateBooking =
    role === "ADMIN" ||
    (role === "EMPLOYEE" && (subRole === "TICKET_COUNTER" || subRole === "SALES_EXECUTIVE"));

  if (!canCreateBooking) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const normalizedLines = payload.ticketLines.reduce<Map<string, number>>((acc, line) => {
    const current = acc.get(line.ticketTypeId) ?? 0;
    acc.set(line.ticketTypeId, current + line.quantity);
    return acc;
  }, new Map());
  const normalizedTicketLines: TicketLine[] = Array.from(normalizedLines.entries()).map(([ticketTypeId, quantity]) => ({
    ticketTypeId,
    quantity,
  }));

  const selectedTicketIds = normalizedTicketLines.map((line) => line.ticketTypeId);

  const [parkConfig, tickets] = await Promise.all([
    db.parkConfig.findFirst({
      select: {
        defaultGstRate: true,
        maxCapacityPerDay: true,
        idProofEnabled: true,
        idProofRequiredAbove: true,
        depositEnabled: true,
        depositPercent: true,
      },
    }),
    db.ticketType.findMany({
      where: {
        id: {
          in: selectedTicketIds,
        },
        isActive: true,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        price: true,
        gstRate: true,
        minAge: true,
        maxAge: true,
        maxPerBooking: true,
        rideId: true,
      },
    }),
  ]);

  if (!parkConfig) {
    return NextResponse.json({ message: "Park configuration not found" }, { status: 500 });
  }

  if (tickets.length !== selectedTicketIds.length) {
    return NextResponse.json({ message: "One or more selected ticket types are invalid" }, { status: 404 });
  }

  const ticketById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  for (const line of normalizedTicketLines) {
    const ticket = ticketById.get(line.ticketTypeId) as { maxPerBooking?: number | null; name?: string } | undefined;
    if (!ticket) continue;
    if (ticket.maxPerBooking !== null && ticket.maxPerBooking !== undefined && line.quantity > ticket.maxPerBooking) {
      return NextResponse.json(
        { message: `${ticket.name ?? "Selected ticket"} allows maximum ${ticket.maxPerBooking} per booking` },
        { status: 400 },
      );
    }
  }
  const totalGuests = normalizedTicketLines.reduce((sum, line) => sum + line.quantity, 0);
  const idProofThreshold = parkConfig.idProofRequiredAbove ?? 10;
  const idProofEnabled = parkConfig.idProofEnabled ?? true;

  if (idProofEnabled && totalGuests > idProofThreshold) {
    if (!extras.idProofType || !extras.idProofNumber || extras.idProofNumber.trim().length === 0) {
      return NextResponse.json(
        { message: "ID proof type and number are required for large groups" },
        { status: 400 },
      );
    }

    if (extras.idProofType === "OTHER" && (!extras.idProofLabel || extras.idProofLabel.trim().length === 0)) {
      return NextResponse.json({ message: "ID proof label is required when proof type is Other" }, { status: 400 });
    }
  }

  const subtotal = normalizedTicketLines.reduce((sum, line) => {
    const ticket = ticketById.get(line.ticketTypeId);
    return sum + (ticket ? Number(ticket.price) * line.quantity : 0);
  }, 0);
  const couponCode = sanitizeCouponCode(payload.couponCode);

  const adults = normalizedTicketLines.reduce((sum, line) => {
    const ticket = ticketById.get(line.ticketTypeId);
    if (!ticket) return sum;
    if (ticket.minAge !== null && ticket.minAge >= 12) return sum + line.quantity;
    if (ticket.maxAge !== null && ticket.maxAge <= 11) return sum;
    if (ticket.name.toLowerCase().includes("child")) return sum;
    return sum + line.quantity;
  }, 0);
  const children = Math.max(0, totalGuests - adults);
  const avgTicketPrice = totalGuests > 0 ? subtotal / totalGuests : 0;

  let discountAmount = 0;
  let couponId: string | null = null;
  let freeLockerApplied = false;
  if (couponCode) {
    const couponResult = await evaluateCoupon({
      code: couponCode,
      subtotal,
      totalGuests,
      adults,
      children,
      adultPrice: avgTicketPrice,
      childPrice: avgTicketPrice,
      ticketTypeIds: normalizedTicketLines.map((line) => line.ticketTypeId),
      visitDate,
      mobile: sanitizeMobile(payload.guestMobile),
      userId: sessionUser?.id ?? null,
    });

    if (!couponResult.valid || !couponResult.couponId) {
      return NextResponse.json({ message: couponResult.message ?? "Coupon is not applicable" }, { status: 400 });
    }

    discountAmount = couponResult.discountAmount;
    couponId = couponResult.couponId;
    freeLockerApplied = couponResult.freeLocker;
  }

  const pricing = calculatePricing({
    lines: normalizedTicketLines.map((line) => {
      const ticket = ticketById.get(line.ticketTypeId);
      return {
        quantity: line.quantity,
        unitPrice: ticket ? Number(ticket.price) : 0,
      };
    }),
    gstRate: Number(parkConfig.defaultGstRate),
    discountAmount,
  });

  const pax = totalGuests;
  const overrideCapacity = false;
  const capacityResult = await assertCapacityAvailable({
    visitDate,
    maxCapacity: parkConfig.maxCapacityPerDay,
    pax,
    allowOverride: overrideCapacity,
  });

  if (!capacityResult.ok) {
    return NextResponse.json(
      {
        message: "Park capacity is full for selected date",
        available: capacityResult.available,
      },
      { status: 409 },
    );
  }

  const bookingId = crypto.randomUUID();
  const bookingNumber = generateBookingNumber();
  const qrCode = generateBookingQrContent({
    bookingId,
    bookingNumber,
    visitDate: payload.visitDate,
  });

  const isComplimentary = pricing.totalAmount <= 0;
  const isAdvancePlanRequested = extras.paymentPlan === "ADVANCE";
  const depositEnabled = Boolean(parkConfig.depositEnabled);
  const defaultAdvancePercent = Number(parkConfig.depositPercent ?? 30);
  const selectedAdvancePercent = Math.max(1, Math.min(90, Number(extras.advancePercent ?? defaultAdvancePercent)));
  const paymentPlan = isComplimentary ? "FULL" : isAdvancePlanRequested && depositEnabled ? "ADVANCE" : "FULL";
  const advanceAmount =
    paymentPlan === "ADVANCE" ? roundMoney(Math.ceil((pricing.totalAmount * selectedAdvancePercent) / 100)) : pricing.totalAmount;
  const balanceDue = roundMoney(Math.max(0, pricing.totalAmount - advanceAmount));

  const selectedMethod = extras.paymentMethod ?? "GATEWAY";
  const paymentReference = extras.paymentReference?.trim() || null;
  const methodIsImmediatePaid = selectedMethod === "CASH" || selectedMethod === "CARD";
  const transactionStatus = isComplimentary ? "PAID" : methodIsImmediatePaid ? "PAID" : "PENDING";
  const bookingStatus = isComplimentary || (paymentPlan === "FULL" && transactionStatus === "PAID") ? "CONFIRMED" : "PENDING";
  const transactionMethod = isComplimentary ? "COMPLIMENTARY" : selectedMethod;

  const encryptedIdProofNumber = extras.idProofNumber && extras.idProofNumber.trim().length > 0
    ? encrypt(sanitizeIdProofNumber(extras.idProofNumber))
    : null;

  const slotTicketTypeIds: string[] = normalizedTicketLines.flatMap((line) =>
    Array.from({ length: line.quantity }).map(() => line.ticketTypeId),
  );

  const builtParticipants = slotTicketTypeIds.map((slotTicketTypeId, index) => {
    const provided = extras.participants?.[index];
    const fallbackName = index === 0 ? sanitizeGuestName(payload.guestName) : `Guest ${index + 1}`;
    const ticketTypeId = slotTicketTypeId;

    return {
      name: sanitizeParticipantName(provided?.name, fallbackName),
      gender: provided?.gender ?? null,
      age: provided?.age ?? null,
      ticketTypeId,
      isLeadGuest: Boolean(provided?.isLeadGuest),
    };
  });

  if (builtParticipants.length > 0) {
    const leadIndex = builtParticipants.findIndex((participant) => participant.isLeadGuest);
    const normalizedLeadIndex = leadIndex >= 0 ? leadIndex : 0;
    for (let i = 0; i < builtParticipants.length; i += 1) {
      builtParticipants[i]!.isLeadGuest = i === normalizedLeadIndex;
    }
  }

  const booking = await db.$transaction(async (tx: any) => {
    const created = await tx.booking.create({
      data: {
        id: bookingId,
        bookingNumber,
        userId: sessionUser?.id ?? null,
        guestName: sanitizeGuestName(payload.guestName),
        guestMobile: sanitizeMobile(payload.guestMobile),
        guestEmail: sanitizeOptionalEmail(payload.guestEmail),
        visitDate,
        adults,
        children,
        idProofType: extras.idProofType ?? null,
        idProofNumber: encryptedIdProofNumber,
        idProofLabel: extras.idProofType === "OTHER" ? sanitizeIdProofLabel(extras.idProofLabel) : null,
        subtotal: pricing.subtotal,
        gstAmount: pricing.gstAmount,
        discountAmount: pricing.discountAmount,
        totalAmount: pricing.totalAmount,
        status: bookingStatus,
        qrCode,
        couponId,
      },
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        visitDate: true,
        totalAmount: true,
        idProofType: true,
        idProofNumber: true,
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            subRole: true,
          },
        },
      },
    });

    for (const line of normalizedTicketLines) {
      const ticket = ticketById.get(line.ticketTypeId);
      if (!ticket) continue;
      await tx.bookingTicket.create({
        data: {
          bookingId: created.id,
          ticketTypeId: ticket.id,
          quantity: line.quantity,
          unitPrice: ticket.price,
          gstRate: ticket.gstRate,
          totalPrice: Number(ticket.price) * line.quantity,
        },
      });
    }

    await tx.bookingParticipant.createMany({
      data: builtParticipants.map((participant) => ({
        bookingId: created.id,
        name: participant.name,
        gender: participant.gender,
        age: participant.age,
        ticketTypeId: participant.ticketTypeId,
        isLeadGuest: participant.isLeadGuest,
      })),
    });

    await tx.transaction.create({
      data: {
        bookingId: created.id,
        amount: advanceAmount,
        method: transactionMethod,
        status: transactionStatus,
        gatewayRef: transactionMethod === "GATEWAY" ? paymentReference : null,
        upiRef: transactionMethod === "MANUAL_UPI" && paymentReference ? encrypt(paymentReference.trim().toUpperCase()) : null,
        notes: isComplimentary
          ? "Zero amount booking auto-confirmed"
          : freeLockerApplied
            ? "Coupon applied: Free locker benefit included"
            : paymentPlan === "ADVANCE"
              ? `Advance payment initiated (${selectedAdvancePercent}%). Balance due: ₹${balanceDue.toFixed(2)}${paymentReference ? " | Ref submitted" : ""}`
              : methodIsImmediatePaid
                ? `Payment received at booking${paymentReference ? " | Ref submitted" : ""}`
                : `Awaiting payment capture${paymentReference ? " | Ref submitted" : ""}`,
      },
    });

    if (!isComplimentary && paymentPlan === "ADVANCE" && balanceDue > 0) {
      await tx.transaction.create({
        data: {
          bookingId: created.id,
          amount: balanceDue,
          method: "CASH",
          status: "PENDING",
          notes: "Remaining balance due at gate",
        },
      });
    }

    if (couponId) {
      await tx.coupon.update({
        where: { id: couponId },
        data: {
          usedCount: { increment: 1 },
          currentUses: { increment: 1 },
        },
      });
      await tx.couponRedemption.create({
        data: {
          couponId,
          bookingId: created.id,
          mobile: sanitizeMobile(payload.guestMobile),
          userId: sessionUser?.id ?? null,
          discountAmount: pricing.discountAmount,
        },
      });
    }

    if (isComplimentary) {
      await incrementCapacity(visitDate, pax);
    }

    return created;
  });

  const rideQueueIncrements = normalizedTicketLines.reduce<Map<string, number>>((acc, line) => {
    const ticket = ticketById.get(line.ticketTypeId) as { rideId?: string | null } | undefined;
    const rideId = ticket?.rideId ?? null;
    if (!rideId) return acc;
    const current = acc.get(rideId) ?? 0;
    acc.set(rideId, current + line.quantity);
    return acc;
  }, new Map());

  await Promise.all(
    Array.from(rideQueueIncrements.entries()).map(([rideId, quantity]) => incrementQueueBy(rideId, quantity)),
  );

  return NextResponse.json(
    {
      booking: {
        ...booking,
        idProofNumber: undefined,
        idProofMasked: booking.idProofNumber ? `${booking.idProofType ?? "ID"} ${maskIdProof(booking.idProofNumber)}` : null,
        bookedBy: booking.user
          ? {
              id: booking.user.id,
              name: booking.user.name,
              role: booking.user.role,
              subRole: booking.user.subRole,
            }
          : null,
      },
      pricing,
      payment: {
        paymentPlan,
        advancePercent: paymentPlan === "ADVANCE" ? selectedAdvancePercent : 100,
        payNow: advanceAmount,
        balanceDue,
      },
      redirectTo: `/booking/confirmation/${booking.bookingNumber}`,
    },
    { status: 201 },
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  const currentUser = getUserFromSession(session);

  if (!currentUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const role = getRole(session);
  const queryRaw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const query = listQuerySchema.safeParse(queryRaw);
  if (!query.success) {
    return NextResponse.json({ message: "Invalid query params" }, { status: 400 });
  }

  const { page, limit, status, source, search, from, to } = query.data;
  const skip = (page - 1) * limit;
  const where: Record<string, unknown> = {};

  if (status) {
    where.status = status;
  }
  if (source === "PREBOOKING") {
    where.transactions = { none: { posSessionId: { not: null } } };
  } else if (source === "POS") {
    where.transactions = { some: { posSessionId: { not: null } } };
  }

  if (from || to) {
    const visitDate: Record<string, Date> = {};
    if (from) {
      const fromDate = parseDateOnlyToUtc(from);
      if (fromDate) {
        visitDate.gte = fromDate;
      }
    }
    if (to) {
      const toDate = parseDateOnlyToUtc(to);
      if (toDate) {
        visitDate.lte = toDate;
      }
    }
    if (Object.keys(visitDate).length > 0) {
      where.visitDate = visitDate;
    }
  }

  if (search && search.trim().length > 0) {
    const value = search.trim();
    where.OR = [
      { guestName: { contains: value, mode: "insensitive" } },
      { guestMobile: { contains: value } },
      { bookingNumber: { contains: value, mode: "insensitive" } },
    ];
  }

  if (role === "USER") {
    where.OR = [
      { userId: currentUser.id },
      ...(currentUser.mobile ? [{ guestMobile: currentUser.mobile }] : []),
    ];
  } else if (role === "EMPLOYEE") {
    where.userId = currentUser.id;
  } else if (role !== "ADMIN" && role !== "EMPLOYEE") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const [total, records] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
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
          select: {
            id: true,
            quantity: true,
            totalPrice: true,
            ticketType: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    items: records.map((record: any) => ({
      id: record.id,
      bookingNumber: record.bookingNumber,
      userId: record.userId,
      guestName: record.guestName,
      guestMobile: record.guestMobile,
      guestEmail: record.guestEmail,
      visitDate: record.visitDate,
      adults: record.adults,
      children: record.children,
      idProofType: record.idProofType,
      idProofLabel: record.idProofLabel,
      idProofMasked: record.idProofNumber ? `${record.idProofType ?? "ID"} ${maskIdProof(record.idProofNumber)}` : null,
      status: record.status,
      subtotal: Number(record.subtotal),
      gstAmount: Number(record.gstAmount),
      discountAmount: Number(record.discountAmount),
      totalAmount: Number(record.totalAmount),
      couponId: record.couponId,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      bookedBy: record.user
        ? {
            id: record.user.id,
            name: record.user.name,
            role: record.user.role,
            subRole: record.user.subRole,
          }
        : null,
      bookingTickets: record.bookingTickets.map((line: any) => ({
        ...line,
        totalPrice: Number(line.totalPrice),
      })),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}
