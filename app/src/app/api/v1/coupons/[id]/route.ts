import { NextRequest, NextResponse } from "next/server";
import { CouponAppliesTo, CouponDiscountType, CouponTarget, GuestTier, WeekDay } from "@prisma/client";
import { z } from "zod";

import { encodeCouponScopeMatrix, resolveCouponScopeMatrix } from "@/lib/coupon-scope";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const paramsSchema = z.object({
  id: z.string().cuid(),
});

const updateSchema = z
  .object({
    title: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    discountType: z.nativeEnum(CouponDiscountType).optional(),
    discountValue: z.coerce.number().min(0).max(1000000).optional(),
    minOrderAmount: z.coerce.number().min(0).max(1000000).nullable().optional(),
    minBookingAmount: z.coerce.number().min(0).max(1000000).nullable().optional(),
    minGuests: z.coerce.number().int().min(1).max(500).nullable().optional(),
    maxDiscountCap: z.coerce.number().min(0).max(1000000).nullable().optional(),
    maxUses: z.coerce.number().int().min(1).max(1000000).nullable().optional(),
    maxUsesPerUser: z.coerce.number().int().min(1).max(1000).nullable().optional(),
    validFrom: z.string().datetime().optional(),
    validTo: z.string().datetime().optional(),
    validUntil: z.string().datetime().nullable().optional(),
    validDays: z.array(z.nativeEnum(WeekDay)).optional(),
    validForDates: z.array(z.string().date()).optional(),
    target: z.nativeEnum(CouponTarget).optional(),
    allowedTiers: z.array(z.nativeEnum(GuestTier)).optional(),
    appliesTo: z.nativeEnum(CouponAppliesTo).optional(),
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
    buyXQty: z.coerce.number().int().min(1).max(50).nullable().optional(),
    buyYQty: z.coerce.number().int().min(1).max(50).nullable().optional(),
    freeTicketTypeId: z.string().cuid().nullable().optional(),
    flatPerTicketAmount: z.coerce.number().min(0).max(100000).nullable().optional(),
    foodDiscountValue: z.coerce.number().min(0).max(100000).nullable().optional(),
    foodDiscountIsPercent: z.boolean().optional(),
    corporateCode: z.string().trim().max(60).nullable().optional(),
    isPublicOffer: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const { error } = await requireAdmin();
  if (error) return error;

  const params = await Promise.resolve(context.params);
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ message: "Invalid coupon id" }, { status: 400 });
  }

  const coupon = await db.coupon.findFirst({
    where: { id: parsedParams.data.id, isDeleted: false },
    include: {
      couponTicketTypes: { select: { ticketTypeId: true } },
      redemptions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, mobile: true, discountAmount: true, createdAt: true, bookingId: true },
      },
    },
  });

  if (!coupon) {
    return NextResponse.json({ message: "Coupon not found" }, { status: 404 });
  }

  return NextResponse.json({
    coupon: {
      ...coupon,
      discountValue: Number(coupon.discountValue),
      minOrderAmount: coupon.minOrderAmount ? Number(coupon.minOrderAmount) : null,
      minBookingAmount: coupon.minBookingAmount ? Number(coupon.minBookingAmount) : null,
      maxDiscountCap: coupon.maxDiscountCap ? Number(coupon.maxDiscountCap) : null,
      flatPerTicketAmount: coupon.flatPerTicketAmount ? Number(coupon.flatPerTicketAmount) : null,
      foodDiscountValue: coupon.foodDiscountValue ? Number(coupon.foodDiscountValue) : null,
      couponScope: resolveCouponScopeMatrix(coupon.applicableFor),
      redemptions: coupon.redemptions.map((item) => ({
        ...item,
        discountAmount: Number(item.discountAmount),
      })),
    },
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const { error } = await requireAdmin();
  if (error) return error;

  const params = await Promise.resolve(context.params);
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ message: "Invalid coupon id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
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

  const updated = await db.$transaction(async (tx) => {
    const coupon = await tx.coupon.update({
      where: { id: parsedParams.data.id },
      data: {
        title: payload.title,
        description: payload.description ?? undefined,
        discountType: payload.discountType,
        discountValue: payload.discountValue,
        minOrderAmount: payload.minOrderAmount,
        minBookingAmount: payload.minBookingAmount,
        minGuests: payload.minGuests,
        maxDiscountCap: payload.maxDiscountCap,
        maxUses: payload.maxUses,
        maxUsesPerUser: payload.maxUsesPerUser,
        validFrom: payload.validFrom ? new Date(payload.validFrom) : undefined,
        validTo: payload.validTo ? new Date(payload.validTo) : undefined,
        validUntil: payload.validUntil ? new Date(payload.validUntil) : payload.validUntil === null ? null : undefined,
        validDays: payload.validDays,
        validForDates: payload.validForDates ? payload.validForDates.map((item) => new Date(item)) : undefined,
        target: payload.target,
        allowedTiers: payload.allowedTiers,
        appliesTo: payload.appliesTo,
        applicableFor: payload.couponScope ? encodeCouponScopeMatrix(payload.couponScope) : undefined,
        buyXQty: payload.buyXQty,
        buyYQty: payload.buyYQty,
        freeTicketTypeId: payload.freeTicketTypeId,
        flatPerTicketAmount: payload.flatPerTicketAmount,
        foodDiscountValue: payload.foodDiscountValue,
        foodDiscountIsPercent: payload.foodDiscountIsPercent,
        corporateCode: payload.corporateCode,
        isPublicOffer: payload.isPublicOffer,
        isActive: payload.isActive,
      },
    });

    if (payload.ticketTypeIds) {
      await tx.couponTicketType.deleteMany({ where: { couponId: coupon.id } });
      if (payload.ticketTypeIds.length > 0) {
        await tx.couponTicketType.createMany({
          data: payload.ticketTypeIds.map((ticketTypeId) => ({ couponId: coupon.id, ticketTypeId })),
          skipDuplicates: true,
        });
      }
    }

    return coupon;
  });

  return NextResponse.json({
    coupon: {
      ...updated,
      discountValue: Number(updated.discountValue),
      minOrderAmount: updated.minOrderAmount ? Number(updated.minOrderAmount) : null,
      minBookingAmount: updated.minBookingAmount ? Number(updated.minBookingAmount) : null,
      maxDiscountCap: updated.maxDiscountCap ? Number(updated.maxDiscountCap) : null,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const { error } = await requireAdmin();
  if (error) return error;

  const params = await Promise.resolve(context.params);
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ message: "Invalid coupon id" }, { status: 400 });
  }

  await db.coupon.update({
    where: { id: parsedParams.data.id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      isActive: false,
    },
  });

  return NextResponse.json({ success: true });
}
