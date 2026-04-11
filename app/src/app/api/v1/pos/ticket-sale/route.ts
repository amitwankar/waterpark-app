import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { redis } from "@/lib/redis";
import { incrementQueueBy } from "@/lib/rides";
import { requireSubRole } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { withRequestContext } from "@/lib/logger";
import {
  validateCoupon,
  computeCartTotals,
  validateSplitPayment,
  generateBookingNumber,
  type CartLineItem,
  type SplitPaymentLine,
} from "@/lib/pos";
import { logAudit, getIp } from "@/lib/audit";
import { generateBookingQrContent } from "@/lib/qr";
import { sendBookingConfirmationEmail } from "@/lib/mailer";

const lineSchema = z.object({
  ticketTypeId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const paymentLineSchema = z.object({
  method: z.enum(["CASH", "MANUAL_UPI", "CARD", "COMPLIMENTARY"]),
  amount: z.number().positive(),
});

const foodLineSchema = z.object({
  foodItemId: z.string().min(1),
  foodVariantId: z.string().min(1).optional(),
  quantity: z.number().int().min(1).max(20),
});

const lockerLineSchema = z.object({
  lockerId: z.string().min(1),
  amount: z.number().positive(),
});

const costumeLineSchema = z.object({
  costumeItemId: z.string().min(1),
  durationHours: z.number().int().min(1).max(24).default(4),
});

const rideLineSchema = z.object({
  rideId: z.string().min(1),
  quantity: z.number().int().min(1).max(50),
});

const participantSchema = z.object({
  name: z.string().trim().max(100).optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  age: z.number().int().min(1).max(120).optional(),
  ticketTypeId: z.string().min(1),
  isLeadGuest: z.boolean().optional(),
});

const saleSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  sessionId: z.string().min(1),
  guestName: z.string().min(1).max(150),
  guestMobile: z.string().regex(/^[6-9]\d{9}$/),
  guestEmail: z.string().email().optional().or(z.literal("")),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(lineSchema).min(0),
  couponCode: z.string().optional(),
  idProofType: z.enum(["AADHAAR", "DRIVING_LICENSE", "PAN", "PASSPORT", "VOTER_ID", "OTHER"]).optional(),
  idProofNumber: z.string().trim().max(60).optional(),
  idProofLabel: z.string().trim().max(60).optional(),
  foodLines: z.array(foodLineSchema).optional(),
  lockerLines: z.array(lockerLineSchema).optional(),
  costumeLines: z.array(costumeLineSchema).optional(),
  rideLines: z.array(rideLineSchema).optional(),
  participants: z.array(participantSchema).max(100).optional(),
  paymentLines: z.array(paymentLineSchema).min(1),
  notes: z.string().optional(),
});

type OperatingDay = {
  day: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

function parseOperatingHours(value: unknown): OperatingDay[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const row = entry as Record<string, unknown>;
      return {
        day: Number(row.day ?? -1),
        isOpen: Boolean(row.isOpen),
        openTime: String(row.openTime ?? "00:00"),
        closeTime: String(row.closeTime ?? "23:59"),
      };
    })
    .filter((row) => Number.isFinite(row.day) && row.day >= 0 && row.day <= 6);
}

function getKolkataNowParts(): { date: string; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(new Date());
  const date = `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  return {
    date,
    hour,
  };
}

function getWeekDayFromDateString(dateValue: string): number {
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return 0;
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun
  return (jsDay + 6) % 7; // 0=Mon
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const { user, error } = await requireSubRole("TICKET_COUNTER", "SALES_EXECUTIVE");
  if (error) return error;
  const requestLogger = withRequestContext({
    requestId,
    userId: user?.id,
    method: req.method,
    path: req.nextUrl.pathname,
  });

  const body = await req.json();
  const parsed = saleSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    requestLogger.warn(
      {
        issues: parsed.error.issues.length,
        firstIssuePath: firstIssue?.path?.join(".") ?? null,
        firstIssueMessage: firstIssue?.message ?? null,
      },
      "POS ticket sale validation failed",
    );
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const {
    idempotencyKey,
    sessionId,
    guestName,
    guestMobile,
    guestEmail,
    visitDate,
    items,
    couponCode,
    paymentLines,
    notes,
    idProofType,
    idProofNumber,
    idProofLabel,
    foodLines = [],
    lockerLines = [],
    costumeLines = [],
    rideLines = [],
    participants = [],
  } =
    parsed.data;

  if (
    items.length === 0 &&
    foodLines.length === 0 &&
    lockerLines.length === 0 &&
    costumeLines.length === 0 &&
    rideLines.length === 0
  ) {
    requestLogger.warn("POS ticket sale rejected: empty cart");
    return NextResponse.json({ error: "Add at least one ticket or add-on item" }, { status: 400 });
  }
  requestLogger.info(
    {
      sessionId,
      guestMobileSuffix: guestMobile.slice(-4),
      ticketLineCount: items.length,
      paymentLineCount: paymentLines.length,
    },
    "POS ticket sale started",
  );

  const idempotencyRedisKey = idempotencyKey
    ? `pos:idempotency:ticket-sale:${sessionId}:${idempotencyKey}`
    : null;

  if (idempotencyRedisKey) {
    const existing = await redis.get(idempotencyRedisKey);
    if (existing?.startsWith("DONE:")) {
      const payloadRaw = existing.slice(5);
      const payload = JSON.parse(payloadRaw) as {
        bookingId: string;
        bookingNumber: string;
        qrCode: string;
        totals: unknown;
      };
      return NextResponse.json(payload, { status: 200 });
    }
    if (existing === "IN_PROGRESS") {
      return NextResponse.json({ error: "Duplicate request in progress" }, { status: 409 });
    }
    await redis.set(idempotencyRedisKey, "IN_PROGRESS", "EX", 120);
  }

  // Verify session is open
  const session = await db.posSession.findFirst({
    where: { id: sessionId, status: "OPEN" },
  });
  if (!session) {
    requestLogger.warn({ sessionId }, "POS ticket sale rejected: no active POS session");
    return NextResponse.json({ error: "No active POS session found" }, { status: 400 });
  }

  // Load ticket types
  const requestedTicketTypeIds = Array.from(new Set(items.map((i) => i.ticketTypeId)));
  const ticketTypes = await db.ticketType.findMany({
    where: {
      id: { in: requestedTicketTypeIds },
      isActive: true,
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
      price: true,
      gstRate: true,
      maxAge: true,
      rideId: true,
    },
  });
  if (ticketTypes.length !== requestedTicketTypeIds.length) {
    requestLogger.warn(
      { requested: requestedTicketTypeIds.length, found: ticketTypes.length },
      "POS ticket sale rejected: invalid or inactive ticket type",
    );
    return NextResponse.json(
      { error: "One or more ticket types not found or inactive" },
      { status: 400 }
    );
  }

  const ttMap = new Map(ticketTypes.map((t) => [t.id, t]));
  const missingId = items.find((item) => !ttMap.has(item.ticketTypeId));
  if (missingId) {
    requestLogger.warn({ ticketTypeId: missingId.ticketTypeId }, "POS ticket sale rejected: missing ticket type");
    return NextResponse.json(
      { error: "One or more ticket types not found or inactive" },
      { status: 400 }
    );
  }

  // Build cart lines
  const cartLines: CartLineItem[] = items.map((item) => {
    const tt = ttMap.get(item.ticketTypeId)!;
    return {
      ticketTypeId: tt.id,
      name: tt.name,
      quantity: item.quantity,
      unitPrice: Number(tt.price),
      gstRate: Number(tt.gstRate),
    };
  });

  const adults = items.reduce((s, i) => {
    const tt = ttMap.get(i.ticketTypeId)!;
    return tt.maxAge && tt.maxAge < 12 ? s : s + i.quantity;
  }, 0);
  const children = items.reduce((s, i) => {
    const tt = ttMap.get(i.ticketTypeId)!;
    return tt.maxAge && tt.maxAge < 12 ? s + i.quantity : s;
  }, 0);
  const adultPrice = cartLines.find((line) => {
    const tt = ttMap.get(line.ticketTypeId)!;
    return !tt.maxAge || tt.maxAge >= 12;
  })?.unitPrice ?? 0;
  const childPrice = cartLines.find((line) => {
    const tt = ttMap.get(line.ticketTypeId)!;
    return !!tt.maxAge && tt.maxAge < 12;
  })?.unitPrice ?? 0;

  // Coupon
  let couponId: string | undefined;
  let discountAmount = 0;
  if (couponCode) {
    const cv = await validateCoupon(
      couponCode,
      cartLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
      cartLines.map((l) => l.ticketTypeId),
      {
        mobile: guestMobile,
        adults,
        children,
        adultPrice,
        childPrice,
        visitDate: new Date(`${visitDate}T00:00:00.000Z`),
      },
    );
    if (!cv.valid) {
      requestLogger.warn({ couponCode }, "POS ticket sale rejected: invalid coupon");
      return NextResponse.json({ error: cv.reason }, { status: 400 });
    }
    couponId = cv.coupon.id;
    discountAmount = cv.coupon.discountAmount;
  }

  const totals = computeCartTotals(cartLines, discountAmount);

  const selectedFoodIds = Array.from(new Set(foodLines.map((line) => line.foodItemId)));
  const selectedFoodVariantIds = Array.from(
    new Set(foodLines.map((line) => line.foodVariantId).filter((value): value is string => Boolean(value))),
  );
  const selectedLockerIds = lockerLines.map((line) => line.lockerId);
  const selectedCostumeIds = costumeLines.map((line) => line.costumeItemId);
  const selectedRideIds = Array.from(new Set(rideLines.map((line) => line.rideId)));

  const [foodItems, foodVariants, lockers, costumeItems, rides, rideTicketTypes, defaultFoodOutlet, parkConfig] = await Promise.all([
    selectedFoodIds.length > 0
      ? db.foodItem.findMany({
          where: { id: { in: selectedFoodIds }, isDeleted: false, isAvailable: true },
          select: { id: true, name: true, price: true, gstRate: true, category: { select: { outletId: true } } },
        })
      : Promise.resolve([]),
    selectedFoodVariantIds.length > 0
      ? db.foodItemVariant.findMany({
          where: { id: { in: selectedFoodVariantIds }, isAvailable: true },
          select: { id: true, foodItemId: true, name: true, price: true },
        })
      : Promise.resolve([]),
    selectedLockerIds.length > 0
      ? db.locker.findMany({
        where: { id: { in: selectedLockerIds }, isActive: true, status: "AVAILABLE" },
        select: { id: true, number: true, rate: true },
      })
      : Promise.resolve([]),
    selectedCostumeIds.length > 0
      ? db.costumeItem.findMany({
          where: { id: { in: selectedCostumeIds }, isActive: true, status: "AVAILABLE" },
          select: { id: true, name: true, tagNumber: true, rentalRate: true, gstRate: true },
        })
      : Promise.resolve([]),
    selectedRideIds.length > 0
      ? db.ride.findMany({
          where: { id: { in: selectedRideIds }, status: "ACTIVE", isDeleted: false },
          select: { id: true, name: true, entryFee: true, gstRate: true },
        })
      : Promise.resolve([]),
    selectedRideIds.length > 0
      ? db.ticketType.findMany({
          where: { rideId: { in: selectedRideIds }, isActive: true, isDeleted: false },
          select: { id: true, rideId: true, price: true, gstRate: true, name: true },
        })
      : Promise.resolve([]),
    db.foodOutlet.findFirst({
      where: { isActive: true },
      select: { id: true },
    }),
    db.parkConfig.findFirst({
      select: { lockerGstRate: true, defaultGstRate: true },
    }),
  ]);

  if (foodLines.length > 0 && foodItems.length !== selectedFoodIds.length) {
    requestLogger.warn("POS ticket sale rejected: unavailable food item in cart");
    return NextResponse.json({ error: "One or more selected food items are unavailable" }, { status: 400 });
  }
  if (lockerLines.length > 0 && lockers.length !== lockerLines.length) {
    requestLogger.warn("POS ticket sale rejected: unavailable locker in cart");
    return NextResponse.json({ error: "One or more selected lockers are unavailable" }, { status: 400 });
  }
  if (costumeLines.length > 0 && costumeItems.length !== costumeLines.length) {
    requestLogger.warn("POS ticket sale rejected: unavailable costume in cart");
    return NextResponse.json({ error: "One or more selected costumes are unavailable" }, { status: 400 });
  }
  if (rideLines.length > 0 && rides.length !== selectedRideIds.length) {
    requestLogger.warn("POS ticket sale rejected: unavailable ride in cart");
    return NextResponse.json({ error: "One or more selected rides are unavailable" }, { status: 400 });
  }
  if (foodLines.length > 0 && !defaultFoodOutlet) {
    return NextResponse.json({ error: "No active food outlet configured" }, { status: 400 });
  }

  const foodMap = new Map(foodItems.map((item) => [item.id, item]));
  const foodVariantMap = new Map(foodVariants.map((variant) => [variant.id, variant]));
  const lockerMap = new Map(lockers.map((locker) => [locker.id, locker]));
  const costumeMap = new Map(costumeItems.map((item) => [item.id, item]));
  const rideMap = new Map(rides.map((ride) => [ride.id, ride]));
  const rideTicketMap = new Map(rideTicketTypes.map((ticket) => [ticket.rideId!, ticket]));

  const normalizedFoodLines = foodLines.map((line) => {
    const item = foodMap.get(line.foodItemId);
    if (!item) return null;
    const variant = line.foodVariantId ? foodVariantMap.get(line.foodVariantId) : null;
    if (line.foodVariantId && (!variant || variant.foodItemId !== line.foodItemId)) {
      return null;
    }
    const unitPrice = variant ? Number(variant.price) : Number(item.price);
    return {
      ...line,
      variantName: variant?.name ?? null,
      unitPrice,
      gstRate: Number(item.gstRate),
    };
  });

  if (normalizedFoodLines.some((line) => line === null)) {
    requestLogger.warn("POS ticket sale rejected: invalid food variant in cart");
    return NextResponse.json({ error: "One or more selected food variants are invalid/unavailable" }, { status: 400 });
  }

  const safeFoodLines = normalizedFoodLines as Array<{
    foodItemId: string;
    foodVariantId?: string;
    quantity: number;
    variantName: string | null;
    unitPrice: number;
    gstRate: number;
  }>;

  const foodSubtotal = safeFoodLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const foodGst = safeFoodLines.reduce((sum, line) => sum + line.unitPrice * line.quantity * (line.gstRate / 100), 0);
  const foodTotal = safeFoodLines.reduce((sum, line) => {
    return sum + line.unitPrice * line.quantity * (1 + line.gstRate / 100);
  }, 0);
  const lockerGstRate = Number(parkConfig?.lockerGstRate ?? 0);
  const lockerSubtotal = lockerLines.reduce((sum, line) => {
    const locker = lockerMap.get(line.lockerId);
    if (!locker) return sum;
    return sum + Number(locker.rate ?? 0);
  }, 0);
  const lockerGst = lockerLines.reduce((sum, line) => {
    const locker = lockerMap.get(line.lockerId);
    if (!locker) return sum;
    const gstRate = Number((locker as { gstRate?: number | string }).gstRate ?? lockerGstRate);
    return sum + Number(locker.rate ?? 0) * (gstRate / 100);
  }, 0);
  const lockerTotal = lockerSubtotal + lockerGst;
  const costumeSubtotal = costumeLines.reduce((sum, line) => {
    const item = costumeMap.get(line.costumeItemId);
    if (!item) return sum;
    return sum + Number(item.rentalRate);
  }, 0);
  const costumeGst = costumeLines.reduce((sum, line) => {
    const item = costumeMap.get(line.costumeItemId);
    if (!item) return sum;
    const gstRate = Number(item.gstRate ?? 0);
    const resolvedGst = gstRate > 0 ? gstRate : Number(parkConfig?.defaultGstRate ?? 18);
    return sum + Number(item.rentalRate) * (resolvedGst / 100);
  }, 0);
  const costumeTotal = costumeSubtotal + costumeGst;
  const rideSubtotal = rideLines.reduce((sum, line) => {
    const ride = rideMap.get(line.rideId);
    if (!ride) return sum;
    return sum + Number(ride.entryFee) * line.quantity;
  }, 0);
  const rideGst = rideLines.reduce((sum, line) => {
    const ride = rideMap.get(line.rideId);
    if (!ride) return sum;
    const gstRate = Number(ride.gstRate ?? parkConfig?.defaultGstRate ?? 18);
    return sum + Number(ride.entryFee) * line.quantity * (gstRate / 100);
  }, 0);
  const rideTotal = rideSubtotal + rideGst;
  const addOnSubtotal = foodSubtotal + lockerSubtotal + costumeSubtotal + rideSubtotal;
  const addOnGst = foodGst + lockerGst + costumeGst + rideGst;
  const grandTotal = Math.round((totals.totalAmount + foodTotal + lockerTotal + costumeTotal + rideTotal) * 100) / 100;

  // Validate split payment
  const splitCheck = validateSplitPayment(paymentLines as SplitPaymentLine[], grandTotal);
  if (!splitCheck.valid) {
    requestLogger.warn({ reason: splitCheck.reason }, "POS ticket sale rejected: invalid split payment");
    return NextResponse.json({ error: splitCheck.reason }, { status: 400 });
  }

  const settings = await getSettings();
  const totalGuests = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const now = getKolkataNowParts();
  const visitDayDiff = Math.floor(
    (new Date(`${visitDate}T00:00:00+05:30`).getTime() - new Date(`${now.date}T00:00:00+05:30`).getTime()) /
      (24 * 60 * 60 * 1000),
  );

  if (visitDayDiff < Number(settings.minDaysAhead) || visitDayDiff > Number(settings.maxDaysAhead)) {
    requestLogger.warn({ visitDate, visitDayDiff }, "POS ticket sale rejected: visit date outside allowed range");
    return NextResponse.json(
      { error: `Visit date must be between ${settings.minDaysAhead} and ${settings.maxDaysAhead} days ahead` },
      { status: 400 },
    );
  }

  if (visitDayDiff === 0 && now.hour >= Number(settings.bookingCutoffHour)) {
    requestLogger.warn({ visitDate, cutoffHour: settings.bookingCutoffHour }, "POS ticket sale rejected: same-day cutoff exceeded");
    return NextResponse.json(
      { error: `Same-day booking is closed after ${settings.bookingCutoffHour}:00` },
      { status: 400 },
    );
  }

  const holidays = await db.parkHoliday.findMany({
    where: { date: new Date(`${visitDate}T00:00:00.000Z`) },
    select: { type: true, name: true },
  });
  const closedHoliday = holidays.find((holiday) => holiday.type === "CLOSED");
  if (closedHoliday) {
    requestLogger.warn({ visitDate, holiday: closedHoliday.name }, "POS ticket sale rejected: park holiday closure");
    return NextResponse.json({ error: `Park is closed on selected date (${closedHoliday.name})` }, { status: 400 });
  }

  const operatingHours = parseOperatingHours(settings.operatingHours);
  const visitWeekDay = getWeekDayFromDateString(visitDate);
  const dayConfig = operatingHours.find((entry) => entry.day === visitWeekDay);
  if (dayConfig && !dayConfig.isOpen) {
    requestLogger.warn({ visitDate, weekDay: visitWeekDay }, "POS ticket sale rejected: closed operating day");
    return NextResponse.json({ error: "Park is closed on selected day" }, { status: 400 });
  }

  const needsIdProof = Boolean(settings.idProofEnabled) && totalGuests > settings.idProofRequiredAbove;

  if (needsIdProof) {
    if (!idProofType || !idProofNumber?.trim()) {
      requestLogger.warn({ totalGuests, threshold: settings.idProofRequiredAbove }, "POS ticket sale rejected: missing required id proof");
      return NextResponse.json(
        { error: `ID proof is required for bookings above ${settings.idProofRequiredAbove} guests` },
        { status: 400 },
      );
    }
    if (idProofType === "OTHER" && !idProofLabel?.trim()) {
      requestLogger.warn("POS ticket sale rejected: missing OTHER id proof label");
      return NextResponse.json({ error: "ID label is required when ID proof type is OTHER" }, { status: 400 });
    }
  }

  const allowedMethods = new Set<SplitPaymentLine["method"]>(["CASH", "CARD", "COMPLIMENTARY"]);
  if (settings.manualUpiEnabled) allowedMethods.add("MANUAL_UPI");

  const hasDisabledMethod = paymentLines.some((line) => !allowedMethods.has(line.method));
  if (hasDisabledMethod) {
    requestLogger.warn("POS ticket sale rejected: disabled payment method selected");
    return NextResponse.json({ error: "Selected payment method is disabled in park settings" }, { status: 400 });
  }

  const participantSlots = cartLines.flatMap((line) =>
    Array.from({ length: line.quantity }).map(() => line.ticketTypeId),
  );
  const participantByTicket = new Set(cartLines.map((line) => line.ticketTypeId));
  if (participants.some((participant) => !participantByTicket.has(participant.ticketTypeId))) {
    requestLogger.warn("POS ticket sale rejected: participant with invalid ticket type");
    return NextResponse.json({ error: "Participant contains invalid ticket type" }, { status: 400 });
  }
  if (participants.length > participantSlots.length) {
    requestLogger.warn("POS ticket sale rejected: participant rows exceed quantity");
    return NextResponse.json({ error: "Participant rows exceed ticket quantity" }, { status: 400 });
  }

  const builtParticipants = participantSlots.map((slotTicketTypeId, index) => {
    const provided = participants[index];
    const fallbackName = index === 0 ? guestName.trim() : `Guest ${index + 1}`;
    return {
      ticketTypeId: slotTicketTypeId,
      name: provided?.name?.trim().length ? provided.name.trim() : fallbackName,
      gender: provided?.gender ?? null,
      age: provided?.age ?? null,
      isLeadGuest: Boolean(provided?.isLeadGuest),
    };
  });
  if (builtParticipants.length > 0) {
    const leadIndex = builtParticipants.findIndex((participant) => participant.isLeadGuest);
    const normalizedLeadIndex = leadIndex >= 0 ? leadIndex : 0;
    for (let index = 0; index < builtParticipants.length; index += 1) {
      builtParticipants[index]!.isLeadGuest = index === normalizedLeadIndex;
    }
  }

  // Transactional create
  const bookingId = crypto.randomUUID();
  const bookingNumber = await generateBookingNumber();
  const qrCode = generateBookingQrContent({ bookingId, bookingNumber, visitDate });

  const result = await db.$transaction(async (tx) => {
    // Create booking
    const booking = await tx.booking.create({
      data: {
        id: bookingId,
        bookingNumber,
        qrCode,
        guestName,
        guestMobile,
        guestEmail: guestEmail?.trim() || null,
        visitDate: new Date(visitDate),
        adults: adults || items.reduce((s, i) => s + i.quantity, 0),
        children,
        idProofType: idProofType ?? null,
        idProofNumber: idProofNumber ? encrypt(idProofNumber.replace(/\s+/g, "").toUpperCase()) : null,
        idProofLabel: idProofType === "OTHER" ? idProofLabel?.trim() || null : null,
        subtotal: totals.subtotal + addOnSubtotal,
        gstAmount: totals.gstAmount + addOnGst,
        discountAmount: totals.discountAmount,
        totalAmount: totals.totalAmount + addOnSubtotal + addOnGst,
        status: "CONFIRMED",
        couponId,
        notes,
        bookingTickets: {
          create: cartLines.map((line) => ({
            ticketTypeId: line.ticketTypeId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            gstRate: line.gstRate,
            totalPrice: line.unitPrice * line.quantity,
          })),
        },
        participants: {
          create: builtParticipants.map((participant) => ({
            ticketTypeId: participant.ticketTypeId,
            name: participant.name,
            gender: participant.gender,
            age: participant.age,
            isLeadGuest: participant.isLeadGuest,
          })),
        },
      },
    });

    // Ensure ride-linked ticket types exist
    if (rideLines.length > 0) {
      for (const line of rideLines) {
        if (rideTicketMap.has(line.rideId)) continue;
        const ride = rideMap.get(line.rideId)!;
        const created = await tx.ticketType.create({
          data: {
            name: `${ride.name} Ride`,
            description: `Ride access for ${ride.name}`,
            price: ride.entryFee,
            gstRate: ride.gstRate ?? parkConfig?.defaultGstRate ?? 18,
            rideId: ride.id,
            validDays: 1,
            isActive: true,
            isDeleted: false,
            sortOrder: 0,
          },
        });
        rideTicketMap.set(line.rideId, created);
      }
    }

    if (rideLines.length > 0) {
      await tx.bookingTicket.createMany({
        data: rideLines.map((line) => {
          const ride = rideMap.get(line.rideId)!;
          const ticket = rideTicketMap.get(line.rideId)!;
          const gstRate = Number(ride.gstRate ?? parkConfig?.defaultGstRate ?? 18);
          return {
            bookingId: booking.id,
            ticketTypeId: ticket.id,
            quantity: line.quantity,
            unitPrice: Number(ride.entryFee),
            gstRate,
            totalPrice: Number(ride.entryFee) * line.quantity,
          };
        }),
      });
    }

    // Create transactions for each payment line
    await tx.transaction.createMany({
      data: (paymentLines as SplitPaymentLine[]).map((pl) => ({
        bookingId: booking.id,
        posSessionId: sessionId,
        amount: pl.amount,
        method: pl.method,
        status: "PAID" as const,
        verifiedById: user!.id,
        verifiedAt: new Date(),
      })),
    });

    // Increment coupon usage
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
          bookingId: booking.id,
          userId: user!.id,
          mobile: guestMobile,
          discountAmount,
        },
      });
    }

    // Upsert GuestProfile
    await tx.guestProfile.upsert({
      where: { mobile: guestMobile },
      update: {
        name: guestName,
        totalVisits: { increment: 1 },
        totalSpend: { increment: grandTotal },
        lastVisitDate: new Date(visitDate),
      },
      create: {
        mobile: guestMobile,
        name: guestName,
        totalVisits: 1,
        totalSpend: grandTotal,
        lastVisitDate: new Date(visitDate),
      },
    });

    if (safeFoodLines.length > 0 && defaultFoodOutlet) {
      const method = (paymentLines[0]?.method ?? "CASH") as "CASH" | "MANUAL_UPI" | "CARD" | "COMPLIMENTARY";
      const foodPaymentMethod: "CASH" | "UPI" | "WRISTBAND" =
        method === "MANUAL_UPI" ? "UPI" : "CASH";
      const foodSubtotal = safeFoodLines.reduce((sum, line) => {
        return sum + line.unitPrice * line.quantity;
      }, 0);
      const foodGst = safeFoodLines.reduce((sum, line) => {
        return sum + line.unitPrice * line.quantity * (line.gstRate / 100);
      }, 0);

      await tx.foodOrder.create({
        data: {
          outletId: defaultFoodOutlet.id,
          bookingId: booking.id,
          guestName,
          guestMobile,
          subtotal: foodSubtotal,
          gstAmount: foodGst,
          totalAmount: foodSubtotal + foodGst,
          paymentMethod: foodPaymentMethod,
          status: "PENDING",
          staffId: user!.id,
          orderItems: {
            create: safeFoodLines.map((line) => {
              const item = foodMap.get(line.foodItemId)!;
              return {
                foodItemId: item.id,
                foodVariantId: line.foodVariantId ?? null,
                name: item.name,
                variantName: line.variantName,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                gstRate: line.gstRate,
                totalPrice: line.unitPrice * line.quantity,
              };
            }),
          },
        },
      });
    }

    if (lockerLines.length > 0) {
      const dueAt = new Date();
      dueAt.setHours(23, 59, 59, 999);
      for (const line of lockerLines) {
        const locker = lockerMap.get(line.lockerId)!;
        const baseAmount = Number(locker.rate ?? 0);
        const resolvedGstRate = Number((locker as { gstRate?: number | string }).gstRate ?? lockerGstRate);
        const totalAmount = Math.round(baseAmount * (1 + resolvedGstRate / 100) * 100) / 100;
        await tx.lockerAssignment.create({
          data: {
            lockerId: locker.id,
            bookingId: booking.id,
            guestName,
            guestMobile,
            assignedById: user!.id,
            durationType: "FULL_DAY",
            dueAt,
            amount: totalAmount,
            paymentMethod: paymentLines[0]?.method ?? "CASH",
            notes: "PREBOOKED:PENDING",
          },
        });
        await tx.locker.update({
          where: { id: locker.id },
          data: { status: "ASSIGNED" },
        });
      }
    }

    if (costumeLines.length > 0) {
      for (const line of costumeLines) {
        const item = costumeMap.get(line.costumeItemId)!;
        const dueAt = new Date(Date.now() + line.durationHours * 60 * 60 * 1000);
        await tx.costumeRental.create({
          data: {
            costumeItemId: item.id,
            bookingId: booking.id,
            posSessionId: sessionId,
            guestName,
            guestMobile,
            rentedById: user!.id,
            dueAt,
            rentalAmount: item.rentalRate,
            depositAmount: 0,
            depositPaid: false,
            paymentMethod: paymentLines[0]?.method ?? "CASH",
            notes: "PREBOOKED:PENDING",
          },
        });
        await tx.costumeItem.update({
          where: { id: item.id },
          data: { status: "RENTED" },
        });
      }
    }

    return booking;
  });

  const rideQueueIncrements = cartLines.reduce<Map<string, number>>((acc, line) => {
    const ticket = ttMap.get(line.ticketTypeId);
    const rideId = (ticket as { rideId?: string | null } | undefined)?.rideId ?? null;
    if (!rideId) return acc;
    const current = acc.get(rideId) ?? 0;
    acc.set(rideId, current + line.quantity);
    return acc;
  }, new Map());
  for (const rideLine of rideLines) {
    const current = rideQueueIncrements.get(rideLine.rideId) ?? 0;
    rideQueueIncrements.set(rideLine.rideId, current + rideLine.quantity);
  }

  await Promise.all(
    Array.from(rideQueueIncrements.entries()).map(([rideId, quantity]) => incrementQueueBy(rideId, quantity)),
  );

  await logAudit({
    userId: user!.id,
    userRole: user!.role,
    action: "pos.ticket_sale",
    entity: "Booking",
    entityId: result.id,
    newValue: {
      bookingNumber: result.bookingNumber,
      totalAmount: grandTotal,
      sessionId,
    },
    ipAddress: getIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  // Send confirmation email if guest provided email
  if (guestEmail?.trim()) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    sendBookingConfirmationEmail({
      email: guestEmail.trim(),
      name: guestName,
      bookingNumber: result.bookingNumber,
      visitDate,
      qrLink: `${appUrl}/booking/confirmation/${result.bookingNumber}`,
      ticketLines: cartLines.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      totalAmount: totals.totalAmount + addOnSubtotal + addOnGst,
    }).catch(() => { /* non-fatal */ });
  }

  const responsePayload = {
    bookingId: result.id,
    bookingNumber: result.bookingNumber,
    qrCode,
    totals: {
      ...totals,
      addOns: {
        food: Math.round(foodTotal * 100) / 100,
        locker: Math.round(lockerTotal * 100) / 100,
        costume: Math.round(costumeTotal * 100) / 100,
        ride: Math.round(rideTotal * 100) / 100,
        gst: Math.round(addOnGst * 100) / 100,
      },
      grandTotal,
    },
  };

  if (idempotencyRedisKey) {
    await redis.set(idempotencyRedisKey, `DONE:${JSON.stringify(responsePayload)}`, "EX", 3600);
  }
  requestLogger.info(
    {
      bookingId: result.id,
      bookingNumber: result.bookingNumber,
      grandTotal,
    },
    "POS ticket sale completed",
  );

  return NextResponse.json(responsePayload, { status: 201 });
}
