import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getIp, logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/session";
import { getSettings, invalidateSettingsCache, maskConfig, upsertSettings } from "@/lib/settings";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{3}$/;

const toNumber = z.coerce.number();

const schema = z.object({
  defaultGstRate: toNumber.min(0).max(100),
  foodGstRate: toNumber.min(0).max(100),
  lockerGstRate: toNumber.min(0).max(100),
  gstNumber: z.string().trim().toUpperCase().regex(GSTIN_REGEX).optional().or(z.literal("")),
  invoicePrefix: z.string().trim().min(1).max(20),
  invoiceStartNumber: toNumber.int().min(1).max(9_999_999),
  loyaltyEnabled: z.boolean(),
  pointsPerRupee: toNumber.min(0).max(100),
  pointRedeemValue: toNumber.min(0).max(100),
  maxRedeemPercent: toNumber.min(0).max(100),
  pointsExpiryDays: toNumber.int().min(30).max(3650),
});

export async function PUT(request: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const payload = parsed.data;
  const before = await getSettings();

  const updated = await upsertSettings({
    defaultGstRate: payload.defaultGstRate,
    foodGstRate: payload.foodGstRate,
    lockerGstRate: payload.lockerGstRate,
    gstNumber: payload.gstNumber || null,
    invoicePrefix: payload.invoicePrefix,
    invoiceStartNumber: payload.invoiceStartNumber,
    loyaltyEnabled: payload.loyaltyEnabled,
    loyaltyPointsPerRupee: payload.pointsPerRupee,
    pointRedeemValue: payload.pointRedeemValue,
    maxRedeemPercent: payload.maxRedeemPercent,
    pointsExpiryDays: payload.pointsExpiryDays,
  });

  invalidateSettingsCache();

  await logAudit({
    userId: user.id,
    userRole: user.role,
    action: "settings.update",
    entity: "ParkConfig",
    entityId: "pricing",
    oldValue: {
      defaultGstRate: Number(before.defaultGstRate),
      foodGstRate: Number(before.foodGstRate),
      lockerGstRate: Number(before.lockerGstRate),
      gstNumber: before.gstNumber,
      invoicePrefix: before.invoicePrefix,
      invoiceStartNumber: before.invoiceStartNumber,
      loyaltyEnabled: before.loyaltyEnabled,
      pointsPerRupee: Number(before.loyaltyPointsPerRupee),
      pointRedeemValue: Number(before.pointRedeemValue),
      maxRedeemPercent: Number(before.maxRedeemPercent),
      pointsExpiryDays: before.pointsExpiryDays,
    },
    newValue: payload,
    ipAddress: getIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json(maskConfig(updated as unknown as Record<string, unknown>));
}
