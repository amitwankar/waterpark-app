import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSubRole } from "@/lib/session";
import { validateCoupon } from "@/lib/pos";

const schema = z.object({
  code: z.string().min(1),
  subtotal: z.number().positive(),
  ticketTypeIds: z.array(z.string()).default([]),
  mobile: z.string().regex(/^[6-9]\d{9}$/).optional(),
  adults: z.number().int().min(0).optional(),
  children: z.number().int().min(0).optional(),
  adultPrice: z.number().min(0).optional(),
  childPrice: z.number().min(0).optional(),
  visitDate: z.string().date().optional(),
}).strict();

export async function POST(req: NextRequest) {
  const { error } = await requireSubRole(
    "TICKET_COUNTER", "FB_STAFF", "LOCKER_ATTENDANT"
  );
  if (error) return error;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const result = await validateCoupon(
    parsed.data.code,
    parsed.data.subtotal,
    parsed.data.ticketTypeIds,
    {
      mobile: parsed.data.mobile,
      adults: parsed.data.adults,
      children: parsed.data.children,
      adultPrice: parsed.data.adultPrice,
      childPrice: parsed.data.childPrice,
      visitDate: parsed.data.visitDate ? new Date(`${parsed.data.visitDate}T00:00:00.000Z`) : undefined,
    },
  );

  return NextResponse.json(result);
}
