import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const now = new Date();
  const items = await db.coupon.findMany({
    where: {
      isDeleted: false,
      isActive: true,
      isPublicOffer: true,
      validFrom: { lte: now },
      OR: [
        { validUntil: null, validTo: { gte: now } },
        { validUntil: { gte: now } },
      ],
    },
    select: {
      id: true,
      code: true,
      title: true,
      description: true,
      discountType: true,
      discountValue: true,
      minBookingAmount: true,
      minOrderAmount: true,
      validUntil: true,
      validTo: true,
    },
    orderBy: [{ validUntil: "asc" }, { validTo: "asc" }],
    take: 30,
  });

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      discountValue: Number(item.discountValue),
      minBookingAmount: item.minBookingAmount ? Number(item.minBookingAmount) : null,
      minOrderAmount: item.minOrderAmount ? Number(item.minOrderAmount) : null,
      expiresAt: item.validUntil ?? item.validTo,
    })),
  });
}
