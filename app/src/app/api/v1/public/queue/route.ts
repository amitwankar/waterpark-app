import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { allocateNextQueueCode, getIstTodayDateOnly } from "@/lib/queue-public";
import { checkRateLimit } from "@/lib/rate-limit";

const toInt = z.coerce.number().int();

const participantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  age: z.coerce.number().int().min(0).max(120).optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
});

const ticketLineSchema = z.object({
  ticketTypeId: z.string().min(1),
  quantity: toInt.min(1).max(100),
});

const packageLineSchema = z.object({
  packageId: z.string().min(1),
  quantity: toInt.min(1).max(100),
});

const foodLineSchema = z.object({
  foodItemId: z.string().min(1),
  foodVariantId: z.string().min(1).optional(),
  quantity: toInt.min(1).max(200),
});

const lockerLineSchema = z.object({
  lockerId: z.string().min(1),
  quantity: toInt.min(1).max(50),
});

const costumeLineSchema = z.object({
  costumeItemId: z.string().min(1),
  quantity: toInt.min(1).max(50),
});

const rideLineSchema = z.object({
  rideId: z.string().min(1),
  quantity: toInt.min(1).max(200),
});

const schema = z
  .object({
    guestName: z.string().trim().min(2).max(120),
    guestMobile: z.string().trim().regex(/^[6-9]\d{9}$/).optional().or(z.literal("")),
    guestEmail: z.string().trim().email().max(255).optional().or(z.literal("")),
    participants: z.array(participantSchema).max(200).optional(),
    ticketLines: z.array(ticketLineSchema).min(1).max(20),
    packageLines: z.array(packageLineSchema).max(50).optional(),
    foodLines: z.array(foodLineSchema).max(100).optional(),
    lockerLines: z.array(lockerLineSchema).max(50).optional(),
    costumeLines: z.array(costumeLineSchema).max(50).optional(),
    rideLines: z.array(rideLineSchema).max(50).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeTagBase(tagNumber: string): string {
  return tagNumber.trim().toUpperCase().replace(/-\d{3}$/i, "");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit({
    endpoint: "public-queue",
    identifier: ip,
    limit: 25,
    windowSec: 60 * 60,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const payload = parsed.data;
  const ticketLines = payload.ticketLines;
  const packageLines = payload.packageLines ?? [];
  const foodLines = payload.foodLines ?? [];
  const lockerLines = payload.lockerLines ?? [];
  const costumeLines = payload.costumeLines ?? [];
  const rideLines = payload.rideLines ?? [];

  const [ticketTypes, packages, foodItems, foodVariants, lockers, costumeItems, rides] = await Promise.all([
    db.ticketType.findMany({
      where: { id: { in: Array.from(new Set(ticketLines.map((l) => l.ticketTypeId))) }, isDeleted: false, isActive: true },
      select: { id: true, name: true, price: true, gstRate: true },
    }),
    packageLines.length
      ? db.salesPackage.findMany({
          where: { id: { in: Array.from(new Set(packageLines.map((l) => l.packageId))) }, isDeleted: false, isActive: true },
          select: { id: true, name: true, salePrice: true, gstRate: true },
        })
      : Promise.resolve([]),
    foodLines.length
      ? db.foodItem.findMany({
          where: { id: { in: Array.from(new Set(foodLines.map((l) => l.foodItemId))) }, isDeleted: false, isAvailable: true },
          select: { id: true, name: true, price: true, gstRate: true },
        })
      : Promise.resolve([]),
    foodLines.length
      ? db.foodItemVariant.findMany({
          where: { id: { in: Array.from(new Set(foodLines.map((l) => l.foodVariantId).filter(Boolean) as string[])) }, isAvailable: true },
          select: { id: true, foodItemId: true, name: true, price: true },
        })
      : Promise.resolve([]),
    lockerLines.length
      ? db.locker.findMany({
          where: { id: { in: Array.from(new Set(lockerLines.map((l) => l.lockerId))) }, isActive: true },
          select: { id: true, rate: true, gstRate: true },
        })
      : Promise.resolve([]),
    costumeLines.length
      ? db.costumeItem.findMany({
          where: { isActive: true, status: "AVAILABLE" },
          select: { id: true, tagNumber: true, name: true, rentalRate: true, gstRate: true },
        })
      : Promise.resolve([]),
    rideLines.length
      ? db.ride.findMany({
          where: { id: { in: Array.from(new Set(rideLines.map((l) => l.rideId))) }, isDeleted: false, status: "ACTIVE" },
          select: { id: true, name: true, entryFee: true, gstRate: true },
        })
      : Promise.resolve([]),
  ]);

  const ticketMap = new Map(ticketTypes.map((t) => [t.id, t]));
  if (ticketTypes.length !== Array.from(new Set(ticketLines.map((l) => l.ticketTypeId))).length) {
    return NextResponse.json({ message: "One or more selected tickets are invalid/inactive" }, { status: 400 });
  }
  const packageMap = new Map(packages.map((p) => [p.id, p]));
  if (packages.length !== Array.from(new Set(packageLines.map((l) => l.packageId))).length) {
    return NextResponse.json({ message: "One or more selected packages are invalid/inactive" }, { status: 400 });
  }
  const foodItemMap = new Map(foodItems.map((f) => [f.id, f]));
  if (foodItems.length !== Array.from(new Set(foodLines.map((l) => l.foodItemId))).length) {
    return NextResponse.json({ message: "One or more selected food items are invalid/unavailable" }, { status: 400 });
  }
  const variantMap = new Map(foodVariants.map((v) => [v.id, v]));
  for (const line of foodLines) {
    if (line.foodVariantId) {
      const variant = variantMap.get(line.foodVariantId);
      if (!variant || variant.foodItemId !== line.foodItemId) {
        return NextResponse.json({ message: "One or more selected food variants are invalid/unavailable" }, { status: 400 });
      }
    }
  }
  const lockerMap = new Map(lockers.map((l) => [l.id, l]));
  if (lockers.length !== Array.from(new Set(lockerLines.map((l) => l.lockerId))).length) {
    return NextResponse.json({ message: "One or more selected lockers are invalid" }, { status: 400 });
  }
  const rideMap = new Map(rides.map((r) => [r.id, r]));
  if (rides.length !== Array.from(new Set(rideLines.map((l) => l.rideId))).length) {
    return NextResponse.json({ message: "One or more selected rides are invalid/inactive" }, { status: 400 });
  }

  const costumeGroupMap = new Map<string, { name: string; unitPrice: number; gstRate: number; available: number }>();
  for (const item of costumeItems) {
    const groupId = normalizeTagBase(item.tagNumber);
    const existing = costumeGroupMap.get(groupId);
    if (!existing) {
      costumeGroupMap.set(groupId, {
        name: item.name,
        unitPrice: Number(item.rentalRate),
        gstRate: Number(item.gstRate ?? 0),
        available: 1,
      });
    } else {
      existing.available += 1;
    }
  }
  for (const line of costumeLines) {
    const group = costumeGroupMap.get(line.costumeItemId);
    if (!group) {
      return NextResponse.json({ message: "One or more selected costumes are invalid/unavailable" }, { status: 400 });
    }
    if (line.quantity > group.available) {
      return NextResponse.json({ message: `Requested costume quantity exceeds availability for ${group.name}` }, { status: 409 });
    }
  }

  const ticketSubtotal = ticketLines.reduce((sum, line) => sum + Number(ticketMap.get(line.ticketTypeId)!.price) * line.quantity, 0);
  const ticketGstAmount = ticketLines.reduce((sum, line) => {
    const ticket = ticketMap.get(line.ticketTypeId)!;
    return sum + Number(ticket.price) * line.quantity * (Number(ticket.gstRate ?? 0) / 100);
  }, 0);

  const packageSubtotal = packageLines.reduce((sum, line) => sum + Number(packageMap.get(line.packageId)!.salePrice) * line.quantity, 0);
  const packageGstAmount = packageLines.reduce((sum, line) => {
    const pkg = packageMap.get(line.packageId)!;
    return sum + Number(pkg.salePrice) * line.quantity * (Number(pkg.gstRate ?? 0) / 100);
  }, 0);

  const foodSubtotal = foodLines.reduce((sum, line) => {
    const item = foodItemMap.get(line.foodItemId)!;
    const variant = line.foodVariantId ? variantMap.get(line.foodVariantId) : null;
    const unitPrice = variant ? Number(variant.price) : Number(item.price);
    return sum + unitPrice * line.quantity;
  }, 0);
  const foodGstAmount = foodLines.reduce((sum, line) => {
    const item = foodItemMap.get(line.foodItemId)!;
    const variant = line.foodVariantId ? variantMap.get(line.foodVariantId) : null;
    const unitPrice = variant ? Number(variant.price) : Number(item.price);
    return sum + unitPrice * line.quantity * (Number(item.gstRate ?? 0) / 100);
  }, 0);

  const lockerSubtotal = lockerLines.reduce((sum, line) => sum + Number(lockerMap.get(line.lockerId)!.rate) * line.quantity, 0);
  const lockerGstAmount = lockerLines.reduce((sum, line) => {
    const locker = lockerMap.get(line.lockerId)!;
    return sum + Number(locker.rate) * line.quantity * (Number(locker.gstRate ?? 0) / 100);
  }, 0);

  const costumeSubtotal = costumeLines.reduce((sum, line) => sum + costumeGroupMap.get(line.costumeItemId)!.unitPrice * line.quantity, 0);
  const costumeGstAmount = costumeLines.reduce((sum, line) => {
    const group = costumeGroupMap.get(line.costumeItemId)!;
    return sum + group.unitPrice * line.quantity * (group.gstRate / 100);
  }, 0);

  const rideSubtotal = rideLines.reduce((sum, line) => sum + Number(rideMap.get(line.rideId)!.entryFee ?? 0) * line.quantity, 0);
  const rideGstAmount = rideLines.reduce((sum, line) => {
    const ride = rideMap.get(line.rideId)!;
    return sum + Number(ride.entryFee ?? 0) * line.quantity * (Number(ride.gstRate ?? 0) / 100);
  }, 0);

  const subtotal = roundMoney(ticketSubtotal + packageSubtotal + foodSubtotal + lockerSubtotal + costumeSubtotal + rideSubtotal);
  const gstAmount = roundMoney(ticketGstAmount + packageGstAmount + foodGstAmount + lockerGstAmount + costumeGstAmount + rideGstAmount);
  const totalAmount = roundMoney(subtotal + gstAmount);

  let queueCode: string;
  let visitDate: Date;
  try {
    const allocated = await allocateNextQueueCode();
    queueCode = allocated.queueCode;
    visitDate = allocated.visitDate;
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "QUEUE_LIMIT_REACHED") {
      return NextResponse.json({ message: "Queue limit reached for today. Please try again later." }, { status: 429 });
    }
    throw e;
  }

  const storedTickets = ticketLines.map((line) => {
    const t = ticketMap.get(line.ticketTypeId)!;
    return {
      ticketTypeId: t.id,
      name: t.name,
      quantity: line.quantity,
      unitPrice: Number(t.price),
      gstRate: Number(t.gstRate ?? 0),
    };
  });

  const items = {
    tickets: storedTickets,
    posPreload: {
      packageLines: packageLines.map((line) => ({ packageId: line.packageId, quantity: line.quantity })),
      foodLines: foodLines.map((line) => ({ foodItemId: line.foodItemId, foodVariantId: line.foodVariantId, quantity: line.quantity })),
      lockerLines: lockerLines.map((line) => ({ lockerId: line.lockerId, quantity: line.quantity })),
      costumeLines: costumeLines.map((line) => ({ costumeItemId: line.costumeItemId, quantity: line.quantity })),
      rideLines: rideLines.map((line) => ({ rideId: line.rideId, quantity: line.quantity })),
    },
  };

  const participants = payload.participants ?? [];

  const created = await db.queueRequest.create({
    data: {
      queueCode,
      status: "PENDING",
      visitDate: visitDate ?? getIstTodayDateOnly(),
      guestName: payload.guestName,
      guestMobile: payload.guestMobile ? payload.guestMobile : null,
      guestEmail: payload.guestEmail ? payload.guestEmail : null,
      participantCount: participants.length,
      participants: participants.length ? (participants as unknown as object) : undefined,
      items: items as unknown as object,
      subtotal,
      gstAmount,
      totalAmount,
      notes: payload.notes || null,
    },
    select: { id: true, queueCode: true, totalAmount: true },
  });

  return NextResponse.json({
    success: true,
    queueId: created.id,
    queueCode: created.queueCode,
    visitDate: visitDate.toISOString().slice(0, 10),
    totalAmount: Number(created.totalAmount),
  });
}
