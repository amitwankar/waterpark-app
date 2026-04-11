import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const config = await db.parkConfig.findFirst({
    select: {
      id: true,
      parkName: true,
      timezone: true,
      razorpayEnabled: true,
      manualUpiEnabled: true,
      upiId: true,
      upiName: true,
      upiQrImageUrl: true,
      depositEnabled: true,
      depositPercent: true,
      depositLabel: true,
      splitEnabled: true,
      maxSplitMethods: true,
      minSplitAmount: true,
      defaultGstRate: true,
      maxCapacityPerDay: true,
      idProofEnabled: true,
      idProofRequiredAbove: true,
      minDaysAhead: true,
      maxDaysAhead: true,
      bookingCutoffHour: true,
      maxTicketsPerBooking: true,
      operatingHours: true,
    },
  });
  return NextResponse.json(config);
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const existing = await db.parkConfig.findFirst({ select: { id: true } });
  if (!existing) {
    return NextResponse.json({ message: "Park config not found" }, { status: 404 });
  }

  const updated = await db.parkConfig.update({
    where: { id: existing.id },
    data: body,
  });

  return NextResponse.json(updated);
}
