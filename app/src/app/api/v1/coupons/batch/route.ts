import { NextRequest, NextResponse } from "next/server";
import { CouponAppliesTo, CouponDiscountType, CouponTarget } from "@prisma/client";
import { z } from "zod";

import { encodeCouponScopeMatrix } from "@/lib/coupon-scope";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/I/1 to avoid confusion

function randomSegment(len: number): string {
  return Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}

function generateCodes(count: number, prefix: string): string[] {
  const seen = new Set<string>();
  const codes: string[] = [];
  while (codes.length < count) {
    const raw = randomSegment(7);
    const code = prefix ? `${prefix}-${raw}` : raw;
    if (!seen.has(code)) {
      seen.add(code);
      codes.push(code);
    }
  }
  return codes;
}

const batchSchema = z
  .object({
    count: z.coerce.number().int().min(1).max(500),
    prefix: z
      .string()
      .trim()
      .toUpperCase()
      .max(15)
      .regex(/^[A-Z0-9]*$/, "Prefix must be alphanumeric")
      .optional()
      .or(z.literal("")),
    title: z.string().trim().max(120).optional(),
    description: z.string().trim().max(1000).optional(),
    discountType: z.nativeEnum(CouponDiscountType),
    discountValue: z.coerce.number().min(0).max(1000000).default(0),
    minBookingAmount: z.coerce.number().min(0).max(1000000).optional(),
    maxDiscountCap: z.coerce.number().min(0).max(1000000).optional(),
    validFrom: z.string().datetime(),
    validTo: z.string().datetime(),
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
    isActive: z.boolean().optional(),
  })
  .strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const validFromDate = new Date(payload.validFrom);
  const validToDate = new Date(payload.validTo);
  if (validToDate <= validFromDate) {
    return NextResponse.json({ message: "Valid To must be later than Valid From" }, { status: 400 });
  }

  const prefix = payload.prefix?.toUpperCase() || "";
  const codes = generateCodes(payload.count, prefix);

  // Check for any pre-existing codes
  const existing = await db.coupon.findMany({
    where: { code: { in: codes } },
    select: { code: true },
  });
  if (existing.length > 0) {
    return NextResponse.json(
      { message: "Some generated codes already exist. Please retry." },
      { status: 409 },
    );
  }

  const commonData = {
    title: payload.title || null,
    description: payload.description || null,
    discountType: payload.discountType,
    discountValue: payload.discountValue,
    minBookingAmount: payload.minBookingAmount ?? null,
    maxDiscountCap: payload.maxDiscountCap ?? null,
    maxUses: 1,
    maxUsesPerUser: 1,
    validFrom: validFromDate,
    validTo: validToDate,
    target: CouponTarget.ALL,
    appliesTo: CouponAppliesTo.ALL_TICKETS,
    applicableFor: encodeCouponScopeMatrix(payload.couponScope),
    isPublicOffer: false,
    isActive: payload.isActive ?? true,
    validDays: [],
    validForDates: [],
    allowedTiers: [],
  };

  await db.coupon.createMany({
    data: codes.map((code) => ({ ...commonData, code })),
    skipDuplicates: false,
  });

  const parkConfig = await db.parkConfig.findFirst({ select: { parkName: true } });
  const created = await db.coupon.findMany({
    where: { code: { in: codes } },
    select: {
      id: true,
      code: true,
      discountType: true,
      discountValue: true,
      minBookingAmount: true,
      maxDiscountCap: true,
      validFrom: true,
      validTo: true,
    },
    orderBy: { code: "asc" },
  });

  return NextResponse.json(
    {
      count: created.length,
      parkName: parkConfig?.parkName ?? "Waterpark",
      coupons: created.map((c) => ({
        id: c.id,
        code: c.code,
        discountType: c.discountType,
        discountValue: Number(c.discountValue),
        minBookingAmount: c.minBookingAmount ? Number(c.minBookingAmount) : null,
        maxDiscountCap: c.maxDiscountCap ? Number(c.maxDiscountCap) : null,
        validFrom: c.validFrom.toISOString(),
        validTo: c.validTo.toISOString(),
      })),
    },
    { status: 201 },
  );
}
