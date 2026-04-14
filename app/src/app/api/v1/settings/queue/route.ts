import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getIp, logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/session";
import { getSettings, invalidateSettingsCache, maskConfig, upsertSettings } from "@/lib/settings";
import { normalizeQueuePrefix, resetQueueSequence } from "@/lib/queue-public";

const schema = z.object({
  queueLimitPerDay: z.coerce.number().int().min(0).max(100000),
  queuePrefix: z.string().trim().min(1).max(8),
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
    queueLimitPerDay: payload.queueLimitPerDay,
    queuePrefix: normalizeQueuePrefix(payload.queuePrefix),
  });

  invalidateSettingsCache();

  await logAudit({
    userId: user.id,
    userRole: user.role,
    action: "settings.update",
    entity: "ParkConfig",
    entityId: "queue",
    oldValue: {
      queueLimitPerDay: Number((before as any).queueLimitPerDay ?? 0),
      queuePrefix: String((before as any).queuePrefix ?? "Q"),
    },
    newValue: payload,
    ipAddress: getIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json(maskConfig(updated as unknown as Record<string, unknown>));
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  await resetQueueSequence();
  invalidateSettingsCache();

  await logAudit({
    userId: user.id,
    userRole: user.role,
    action: "queue.reset",
    entity: "QueueRequest",
    entityId: "sequence",
    oldValue: null,
    newValue: { resetAt: new Date().toISOString() },
    ipAddress: getIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}

