import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireSubRole } from "@/lib/session";

export async function GET() {
  const { error } = await requireSubRole("TICKET_COUNTER", "SALES_EXECUTIVE");
  if (error) return error;

  const now = new Date();
  const templates = await db.coupon.findMany({
    where: {
      isActive: true,
      validTo: { gte: now },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      code: true,
      title: true,
      description: true,
      discountType: true,
      discountValue: true,
      foodDiscountValue: true,
      foodDiscountIsPercent: true,
      target: true,
      appliesTo: true,
      validFrom: true,
      validTo: true,
    },
    take: 100,
  });

  return NextResponse.json(
    templates.map((item) => ({
      ...item,
      discountValue: Number(item.discountValue),
      foodDiscountValue: item.foodDiscountValue ? Number(item.foodDiscountValue) : null,
    })),
  );
}

