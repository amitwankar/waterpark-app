import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getIp, logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/session";
import {
  getSettings,
  invalidateSettingsCache,
  maskConfig,
  upsertSettings,
} from "@/lib/settings";

const schema = z.object({
  parkName: z.string().trim().min(2).max(150).optional(),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  pincode: z.string().trim().regex(/^\d{6}$/).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable(),
  websiteUrl: z.string().trim().url().max(255).optional().nullable(),
  timezone: z.string().trim().min(3).max(64).optional(),
  logoUrl: z.string().trim().url().max(500).optional().nullable(),
});

export async function PUT(request: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const before = await getSettings();
  const updated = await upsertSettings(parsed.data);
  invalidateSettingsCache();

  await logAudit({
    userId: user.id,
    userRole: user.role,
    action: "settings.update",
    entity: "ParkConfig",
    entityId: "general",
    oldValue: {
      parkName: before.parkName,
      address: before.address,
      phone: before.phone,
      email: before.email,
      timezone: before.timezone,
    },
    newValue: parsed.data,
    ipAddress: getIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json(maskConfig(updated as unknown as Record<string, unknown>));
}
