import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getIp, logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/session";
import { getSettings, invalidateSettingsCache, maskConfig, upsertSettings } from "@/lib/settings";

const toNumber = z.coerce.number();

const schema = z.object({
  maxCapacityPerDay: toNumber.int().min(100).max(100000),
  minDaysAhead: toNumber.int().min(0).max(365),
  maxDaysAhead: toNumber.int().min(1).max(365),
  bookingCutoffHour: toNumber.int().min(0).max(23),
  maxTicketsPerBooking: toNumber.int().min(1).max(100),
});

export async function PUT(request: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  if (parsed.data.minDaysAhead > parsed.data.maxDaysAhead) {
    return NextResponse.json({ error: "minDaysAhead cannot be greater than maxDaysAhead" }, { status: 422 });
  }

  const before = await getSettings();
  const updated = await upsertSettings(parsed.data);
  invalidateSettingsCache();

  await logAudit({
    userId: user.id,
    userRole: user.role,
    action: "settings.update",
    entity: "ParkConfig",
    entityId: "capacity",
    oldValue: {
      maxCapacityPerDay: before.maxCapacityPerDay,
      minDaysAhead: before.minDaysAhead,
      maxDaysAhead: before.maxDaysAhead,
      bookingCutoffHour: before.bookingCutoffHour,
      maxTicketsPerBooking: before.maxTicketsPerBooking,
    },
    newValue: parsed.data,
    ipAddress: getIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json(maskConfig(updated as unknown as Record<string, unknown>));
}
