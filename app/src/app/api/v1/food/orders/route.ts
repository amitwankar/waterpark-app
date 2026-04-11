import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { format } from "date-fns";

import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { requireStaff } from "@/lib/session";

const TOKEN_KEY = (outletId: string, date: string) =>
  `food:token:${outletId}:${date}`;

const orderItemSchema = z.object({
  foodItemId: z.string().min(1),
  foodVariantId: z.string().min(1).optional(),
  modifiers: z
    .array(
      z.object({
        groupId: z.string().min(1),
        optionId: z.string().min(1),
        quantity: z.number().int().positive().optional(),
      }),
    )
    .optional(),
  quantity: z.number().int().positive(),
});

const createSchema = z.object({
  outletId: z.string().min(1),
  bookingId: z.string().optional(),
  guestName: z.string().min(1).max(150),
  guestMobile: z.string().optional(),
  paymentMethod: z.enum(["CASH", "UPI", "WRISTBAND"]),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
});

export async function GET(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const outletId = searchParams.get("outletId");
  const status = searchParams.get("status");
  const date = searchParams.get("date"); // YYYY-MM-DD
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));

  const where: Record<string, unknown> = {};
  if (outletId) where.outletId = outletId;
  if (status) where.status = status;
  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);
    where.createdAt = { gte: start, lte: end };
  }

  const [orders, total] = await Promise.all([
    db.foodOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        outlet: { select: { id: true, name: true } },
        orderItems: true,
        staff: { select: { id: true, name: true } },
      },
    }),
    db.foodOrder.count({ where }),
  ]);

  return NextResponse.json({ orders, total, page, limit });
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireStaff();
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const { outletId, items, ...rest } = parsed.data;

  let bookingGuestName = rest.guestName;
  let bookingGuestMobile = rest.guestMobile;
  if (rest.bookingId) {
    const booking = await db.booking.findUnique({
      where: { id: rest.bookingId },
      select: { status: true, guestName: true, guestMobile: true },
    });
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (booking.status !== "CHECKED_IN") {
      return NextResponse.json({ error: "Booking must be checked in before placing food order" }, { status: 409 });
    }
    bookingGuestName = booking.guestName;
    bookingGuestMobile = booking.guestMobile;
  }

  // Verify outlet exists and is open
  const outlet = await db.foodOutlet.findFirst({
    where: { id: outletId, isActive: true, isOpen: true },
  });
  if (!outlet) {
    return NextResponse.json(
      { error: "Outlet not found or currently closed" },
      { status: 400 }
    );
  }

  // Load food items and validate availability
  const foodItems = await db.foodItem.findMany({
    where: {
      id: { in: items.map((i) => i.foodItemId) },
      isDeleted: false,
      isAvailable: true,
    },
    include: {
      variants: {
        where: { isAvailable: true },
        select: {
          id: true,
          name: true,
          price: true,
          preBookPrice: true,
        },
      },
      modifierGroups: {
        where: { isActive: true },
        include: {
          options: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
        },
      },
    },
  });

  if (foodItems.length !== items.length) {
    return NextResponse.json(
      { error: "One or more items are unavailable or not found" },
      { status: 400 }
    );
  }

  const itemMap = new Map(foodItems.map((fi) => [fi.id, fi]));

  // Compute totals
  let subtotal = 0;
  let gstAmount = 0;

  const orderItems = [];
  for (const i of items) {
    const fi = itemMap.get(i.foodItemId)!;
    let unitPrice = Number(fi.price);
    let variantName: string | undefined;
    let variantId: string | undefined;

    if (i.foodVariantId) {
      const variant = fi.variants.find((row) => row.id === i.foodVariantId);
      if (!variant) {
        return NextResponse.json(
          { error: `Invalid variant selected for ${fi.name}` },
          { status: 422 }
        );
      }
      unitPrice = Number(variant.price);
      variantName = variant.name;
      variantId = variant.id;
    }
    const gstRate = Number(fi.gstRate) / 100;
    let lineTotal = unitPrice * i.quantity;

    const modifierRows: Array<{
      groupId: string;
      optionId: string;
      groupName: string;
      optionName: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }> = [];

    for (const modifier of i.modifiers ?? []) {
      const group = fi.modifierGroups.find((g) => g.id === modifier.groupId);
      if (!group) {
        return NextResponse.json(
          { error: `Invalid modifier group selected for ${fi.name}` },
          { status: 422 },
        );
      }
      const option = group.options.find((o) => o.id === modifier.optionId);
      if (!option) {
        return NextResponse.json(
          { error: `Invalid modifier option selected for ${fi.name}` },
          { status: 422 },
        );
      }
      const qty = modifier.quantity ?? 1;
      const modUnitPrice = Number(option.price);
      const modTotal = modUnitPrice * qty * i.quantity;
      lineTotal += modTotal;
      modifierRows.push({
        groupId: group.id,
        optionId: option.id,
        groupName: group.name,
        optionName: option.name,
        quantity: qty,
        unitPrice: modUnitPrice,
        totalPrice: modTotal,
      });
    }

    subtotal += lineTotal;
    gstAmount += lineTotal * gstRate;

    orderItems.push({
      foodItemId: fi.id,
      foodVariantId: variantId,
      name: fi.name,
      variantName,
      quantity: i.quantity,
      unitPrice,
      gstRate: Number(fi.gstRate),
      totalPrice: lineTotal,
      modifiers: {
        create: modifierRows,
      },
    });
  }

  const totalAmount = subtotal + gstAmount;

  // Assign token via Redis INCR
  const today = format(new Date(), "yyyy-MM-dd");
  const tokenKey = TOKEN_KEY(outletId, today);
  const tokenCount = await redis.incr(tokenKey);
  // Set TTL to end of day only on first creation
  if (tokenCount === 1) {
    await redis.expire(tokenKey, 86400);
  }
  const token = String(tokenCount).padStart(3, "0");

  const order = await db.foodOrder.create({
    data: {
      outletId,
      token,
      staffId: user!.id,
      subtotal,
      gstAmount,
      totalAmount,
      ...rest,
      guestName: bookingGuestName,
      guestMobile: bookingGuestMobile,
      orderItems: { create: orderItems },
    },
    include: { orderItems: true },
  });

  return NextResponse.json(order, { status: 201 });
}
