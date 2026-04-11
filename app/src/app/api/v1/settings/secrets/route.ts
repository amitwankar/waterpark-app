import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getIp, logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/session";
import { getSettings, invalidateSettingsCache, isMaskedValue, upsertSettings } from "@/lib/settings";

const schema = z.object({
  field: z.enum(["razorpayKeyId", "razorpayKeySecret", "whatsappApiKey", "smsApiKey"]),
  value: z.string().trim().min(8).max(512),
});

export async function PUT(request: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  if (isMaskedValue(parsed.data.value)) {
    return NextResponse.json({ error: "Masked values are not accepted for secret updates" }, { status: 400 });
  }

  const before = await getSettings();
  await upsertSettings({ [parsed.data.field]: parsed.data.value });
  invalidateSettingsCache();

  await logAudit({
    userId: user.id,
    userRole: user.role,
    action: "settings.secret_update",
    entity: "ParkConfig",
    entityId: parsed.data.field,
    oldValue: { [parsed.data.field]: before[parsed.data.field as keyof typeof before] ? "configured" : "empty" },
    newValue: { [parsed.data.field]: "updated" },
    ipAddress: getIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, field: parsed.data.field });
}
