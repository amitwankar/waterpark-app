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

const schema = z.object({
  notifyBookingConfirm: z.boolean(),
  notifyCheckin: z.boolean(),
  notifyPaymentReceived: z.boolean(),
  notifyRefund: z.boolean(),
  notifyLoyaltyPoints: z.boolean(),
  whatsappEnabled: z.boolean(),
  whatsappApiKey: z.string().trim().max(255).optional(),
  smsEnabled: z.boolean(),
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

  const cleaned = sanitizeSensitivePatch({
    notifyBookingConfirm: parsed.data.notifyBookingConfirm,
    notifyCheckin: parsed.data.notifyCheckin,
    notifyPaymentReceived: parsed.data.notifyPaymentReceived,
    notifyRefund: parsed.data.notifyRefund,
    notifyLoyaltyPoints: parsed.data.notifyLoyaltyPoints,
    whatsappEnabled: parsed.data.whatsappEnabled,
    whatsappApiKey: parsed.data.whatsappApiKey,
    smsEnabled: parsed.data.smsEnabled,
    smsApiKey: parsed.data.smsApiKey,
  });

  const updated = await upsertSettings(cleaned as never);
  invalidateSettingsCache();

  await logAudit({
    userId: user.id,
    userRole: user.role,
    action: "settings.update",
    entity: "ParkConfig",
    entityId: "notifications",
    oldValue: {
      notifyBookingConfirm: before.notifyBookingConfirm,
      notifyCheckin: before.notifyCheckin,
      notifyPaymentReceived: before.notifyPaymentReceived,
      notifyRefund: before.notifyRefund,
      notifyLoyaltyPoints: before.notifyLoyaltyPoints,
      whatsappEnabled: before.whatsappEnabled,
      smsEnabled: before.smsEnabled,
    },
    newValue: {
      ...parsed.data,
      whatsappApiKey: undefined,
      smsApiKey: undefined,
      keysUpdated: {
        whatsappApiKey: Boolean(parsed.data.whatsappApiKey),
        smsApiKey: Boolean(parsed.data.smsApiKey),
      },
    },
    ipAddress: getIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json(maskConfig(updated as unknown as Record<string, unknown>));
}
