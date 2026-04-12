import { NextRequest, NextResponse } from "next/server";
import { CouponAppliesTo, CouponDiscountType, CouponTarget, GuestTier, WeekDay } from "@prisma/client";
import { z } from "zod";

import { encodeCouponScopeMatrix, resolveCouponScopeMatrix } from "@/lib/coupon-scope";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const querySchema = z.object({
  q: z.string().trim().optional(),
  active: z.enum(["1", "0"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchema = z
  .object({
    code: z.string().trim().min(3).max(30),
    title: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(1000).optional(),
    discountType: z.nativeEnum(CouponDiscountType),
    discountValue: z.coerce.number().min(0).max(1000000).default(0),
    minOrderAmount: z.coerce.number().min(0).max(1000000).optional(),
    minBookingAmount: z.coerce.number().min(0).max(1000000).optional(),
    minGuests: z.coerce.number().int().min(1).max(500).optional(),
    maxDiscountCap: z.coerce.number().min(0).max(1000000).optional(),
    maxUses: z.coerce.number().int().min(1).max(1000000).nullable().optional(),
    maxUsesPerUser: z.coerce.number().int().min(1).max(1000).nullable().optional(),
    validFrom: z.string().datetime(),
    validTo: z.string().datetime(),
    validUntil: z.string().datetime().optional(),
    validDays: z.array(z.nativeEnum(WeekDay)).optional(),
    validForDates: z.array(z.string().date()).optional(),
    target: z.nativeEnum(CouponTarget).default(CouponTarget.ALL),
    allowedTiers: z.array(z.nativeEnum(GuestTier)).optional(),
    appliesTo: z.nativeEnum(CouponAppliesTo).default(CouponAppliesTo.ALL_TICKETS),
    couponScope: z
      .object({
        ticket: z.boolean().optional(),
        food: z.boolean().optional(),
        locker: z.boolean().optional(),
        costume: z.boolean().optional(),
        ride: z.boolean().optional(),
        package: z.boolean().optional(),
      })
      .optional(),
    ticketTypeIds: z.array(z.string().cuid()).optional(),
    buyXQty: z.coerce.number().int().min(1).max(50).optional(),
    buyYQty: z.coerce.number().int().min(1).max(50).optional(),
    freeTicketTypeId: z.string().cuid().optional(),
    flatPerTicketAmount: z.coerce.number().min(0).max(100000).optional(),
    foodDiscountValue: z.coerce.number().min(0).max(100000).optional(),
    foodDiscountIsPercent: z.boolean().optional(),
    corporateCode: z.string().trim().max(60).optional(),
    isPublicOffer: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { error } = await requireAdmin();
  if (error) return error;

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid query" }, { status: 400 });
  }

  const { q, active, page, pageSize } = parsed.data;
  const where = {
    isDeleted: false,
    ...(active ? { isActive: active === "1" } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" as const } },
            { title: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    db.coupon.count({ where }),
    db.coupon.findMany({
      where,
      include: {
        couponTicketTypes: { select: { ticketTypeId: true } },
        _count: { select: { redemptions: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      discountValue: Number(item.discountValue),
      minOrderAmount: item.minOrderAmount ? Number(item.minOrderAmount) : null,
      minBookingAmount: item.minBookingAmount ? Number(item.minBookingAmount) : null,
      maxDiscountCap: item.maxDiscountCap ? Number(item.maxDiscountCap) : null,
      flatPerTicketAmount: item.flatPerTicketAmount ? Number(item.flatPerTicketAmount) : null,
      foodDiscountValue: item.foodDiscountValue ? Number(item.foodDiscountValue) : null,
      couponScope: resolveCouponScopeMatrix(item.applicableFor),
      redemptionCount: item._count.redemptions,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  if (payload.couponScope) {
    const hasAnyScope = Object.values(payload.couponScope).some(Boolean);
    if (!hasAnyScope) {
      return NextResponse.json({ message: "Select at least one coupon scope" }, { status: 400 });
    }
  }
  const code = payload.code.trim().toUpperCase();
  const existing = await db.coupon.findUnique({ where: { code }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ message: "Coupon code already exists" }, { status: 409 });
  }

  const created = await db.coupon.create({
    data: {
      code,
      title: payload.title || null,
      description: payload.description || null,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      minOrderAmount: payload.minOrderAmount ?? null,
      minBookingAmount: payload.minBookingAmount ?? null,
      minGuests: payload.minGuests ?? null,
      maxDiscountCap: payload.maxDiscountCap ?? null,
      maxUses: payload.maxUses ?? null,
      maxUsesPerUser: payload.maxUsesPerUser ?? 1,
      validFrom: new Date(payload.validFrom),
      validTo: new Date(payload.validTo),
      validUntil: payload.validUntil ? new Date(payload.validUntil) : null,
      validDays: payload.validDays ?? [],
      validForDates: (payload.validForDates ?? []).map((item) => new Date(item)),
      target: payload.target,
      allowedTiers: payload.allowedTiers ?? [],
      appliesTo: payload.appliesTo,
      applicableFor: encodeCouponScopeMatrix(payload.couponScope),
      buyXQty: payload.buyXQty ?? null,
      buyYQty: payload.buyYQty ?? null,
      freeTicketTypeId: payload.freeTicketTypeId ?? null,
      flatPerTicketAmount: payload.flatPerTicketAmount ?? null,
      foodDiscountValue: payload.foodDiscountValue ?? null,
      foodDiscountIsPercent: payload.foodDiscountIsPercent ?? true,
      corporateCode: payload.corporateCode || null,
      isPublicOffer: payload.isPublicOffer ?? true,
      isActive: payload.isActive ?? true,
      couponTicketTypes:
        payload.ticketTypeIds && payload.ticketTypeIds.length > 0
          ? {
              createMany: {
                data: payload.ticketTypeIds.map((ticketTypeId) => ({ ticketTypeId })),
                skipDuplicates: true,
              },
            }
          : undefined,
    },
    include: {
      couponTicketTypes: { select: { ticketTypeId: true } },
    },
  });

  return NextResponse.json(
    {
      coupon: {
        ...created,
        discountValue: Number(created.discountValue),
        minOrderAmount: created.minOrderAmount ? Number(created.minOrderAmount) : null,
        minBookingAmount: created.minBookingAmount ? Number(created.minBookingAmount) : null,
        maxDiscountCap: created.maxDiscountCap ? Number(created.maxDiscountCap) : null,
      },
    },
    { status: 201 },
  );
}
