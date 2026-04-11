import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getIp, logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/session";
import { getSettings, invalidateSettingsCache, maskConfig, upsertSettings } from "@/lib/settings";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const daySchema = z.object({
  day: z.number().int().min(0).max(6),
  label: z.string().trim().min(2).max(16),
  isOpen: z.boolean(),
  openTime: z.string().regex(timeRegex),
  closeTime: z.string().regex(timeRegex),
});

const schema = z.object({
  operatingHours: z.array(daySchema).length(7),
});

function toMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export async function PUT(request: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  for (const day of parsed.data.operatingHours) {
    if (day.isOpen && toMinutes(day.openTime) >= toMinutes(day.closeTime)) {
      return NextResponse.json({ error: `Invalid time range for ${day.label}` }, { status: 422 });
    }
  }

  const before = await getSettings();
  const updated = await upsertSettings({
    operatingHours: parsed.data.operatingHours as unknown as object,
  });
  invalidateSettingsCache();

  await logAudit({
    userId: user.id,
    userRole: user.role,
    action: "settings.update",
    entity: "ParkConfig",
    entityId: "operating-hours",
    oldValue: { operatingHours: before.operatingHours },
    newValue: { operatingHours: parsed.data.operatingHours },
    ipAddress: getIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json(maskConfig(updated as unknown as Record<string, unknown>));
}
