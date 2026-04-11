import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getIp, logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/session";
import {
  getSettings,
  invalidateSettingsCache,
  maskConfig,
  sanitizeSensitivePatch,
  upsertSettings,
} from "@/lib/settings";

const toNumber = z.coerce.number();

const schema = z.object({
  razorpayEnabled: z.boolean(),
  manualUpiEnabled: z.boolean(),
  parkUpiId: z.string().trim().max(120).optional().or(z.literal("")),
  parkUpiName: z.string().trim().max(120).optional().or(z.literal("")),
  parkUpiQrImageUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  depositEnabled: z.boolean(),
  depositPercent: toNumber.min(10).max(90),
  depositLabel: z.string().trim().min(3).max(120),
  splitEnabled: z.boolean(),
  maxSplitMethods: toNumber.int().min(1).max(4),
  minSplitAmount: toNumber.min(10).max(100000),
  refundDeductionPercent: toNumber.min(0).max(100),
  whatsappEnabled: z.boolean().optional(),
  whatsappApiKey: z.string().trim().max(255).optional(),
  smsEnabled: z.boolean().optional(),
  smsApiKey: z.string().trim().max(255).optional(),
});

export async function PUT(request: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const before = await getSettings();
  const payload = parsed.data;

  const cleaned = sanitizeSensitivePatch({
    razorpayEnabled: payload.razorpayEnabled,
    manualUpiEnabled: payload.manualUpiEnabled,
    upiId: payload.parkUpiId || null,
    upiName: payload.parkUpiName || null,
    upiQrImageUrl: payload.parkUpiQrImageUrl || null,
    depositEnabled: payload.depositEnabled,
    depositPercent: payload.depositPercent,
    depositLabel: payload.depositLabel,
    splitEnabled: payload.splitEnabled,
    maxSplitMethods: payload.maxSplitMethods,
    minSplitAmount: payload.minSplitAmount,
    refundDeductionPercent: payload.refundDeductionPercent,
    whatsappEnabled: payload.whatsappEnabled,
    whatsappApiKey: payload.whatsappApiKey,
    smsEnabled: payload.smsEnabled,
    smsApiKey: payload.smsApiKey,
  });

  const updated = await upsertSettings(cleaned as never);
  invalidateSettingsCache();

  await logAudit({
    userId: user.id,
    userRole: user.role,
    action: "settings.update",
    entity: "ParkConfig",
    entityId: "payment",
    oldValue: {
      razorpayEnabled: before.razorpayEnabled,
      manualUpiEnabled: before.manualUpiEnabled,
      upiId: before.upiId,
      upiName: before.upiName,
      upiQrImageUrl: before.upiQrImageUrl,
      depositEnabled: before.depositEnabled,
      depositPercent: Number(before.depositPercent),
      depositLabel: before.depositLabel,
      splitEnabled: before.splitEnabled,
      maxSplitMethods: before.maxSplitMethods,
      minSplitAmount: Number(before.minSplitAmount),
      refundDeductionPercent: Number((before as Record<string, unknown>).refundDeductionPercent ?? 0),
      whatsappEnabled: before.whatsappEnabled,
      smsEnabled: before.smsEnabled,
    },
    newValue: {
      razorpayEnabled: payload.razorpayEnabled,
      manualUpiEnabled: payload.manualUpiEnabled,
      parkUpiId: payload.parkUpiId,
      parkUpiName: payload.parkUpiName,
      parkUpiQrImageUrl: payload.parkUpiQrImageUrl,
      depositEnabled: payload.depositEnabled,
      depositPercent: payload.depositPercent,
      depositLabel: payload.depositLabel,
      splitEnabled: payload.splitEnabled,
      maxSplitMethods: payload.maxSplitMethods,
      minSplitAmount: payload.minSplitAmount,
      refundDeductionPercent: payload.refundDeductionPercent,
      whatsappEnabled: payload.whatsappEnabled,
      smsEnabled: payload.smsEnabled,
      keysUpdated: {
        viaDedicatedEndpoint: true,
      },
    },
    ipAddress: getIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json(maskConfig(updated as unknown as Record<string, unknown>));
}
