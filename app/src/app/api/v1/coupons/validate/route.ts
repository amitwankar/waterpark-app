import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { evaluateCoupon } from "@/lib/coupon";

const validateSchema = z
  .object({
    code: z.string().trim().min(1),
    subtotal: z.coerce.number().min(0),
    adults: z.coerce.number().int().min(0).default(0),
    children: z.coerce.number().int().min(0).default(0),
    adultPrice: z.coerce.number().min(0).default(0),
    childPrice: z.coerce.number().min(0).default(0),
    ticketTypeIds: z.array(z.string().trim().min(1)).default([]),
    visitDate: z.string().date(),
    mobile: z.string().trim().regex(/^[6-9]\d{9}$/),
  })
  .strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = validateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ valid: false, message: "Invalid payload", discountAmount: 0 }, { status: 400 });
  }

  const payload = parsed.data;
  const result = await evaluateCoupon({
    code: payload.code,
    subtotal: payload.subtotal,
    totalGuests: payload.adults + payload.children,
    adults: payload.adults,
    children: payload.children,
    adultPrice: payload.adultPrice,
    childPrice: payload.childPrice,
    ticketTypeIds: payload.ticketTypeIds,
    visitDate: new Date(`${payload.visitDate}T00:00:00.000Z`),
    mobile: payload.mobile,
  });

  return NextResponse.json(result, { status: result.valid ? 200 : 400 });
}
