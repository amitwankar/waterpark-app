import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getIp, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { invalidateSettingsCache } from "@/lib/settings";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  type: z.enum(["CLOSED", "SPECIAL_HOURS", "SPECIAL_EVENT"]).optional(),
  specialOpenTime: z.string().regex(timeRegex).optional().or(z.literal("")),
  specialCloseTime: z.string().regex(timeRegex).optional().or(z.literal("")),
  message: z.string().trim().max(500).optional().or(z.literal("")),
});

function toDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const before = await db.parkHoliday.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Holiday not found" }, { status: 404 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const payload = {
    ...(parsed.data.date ? { date: toDateOnly(String(parsed.data.date)) } : {}),
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
    ...(parsed.data.specialOpenTime !== undefined ? { specialOpenTime: parsed.data.specialOpenTime || null } : {}),
    ...(parsed.data.specialCloseTime !== undefined ? { specialCloseTime: parsed.data.specialCloseTime || null } : {}),
    ...(parsed.data.message !== undefined ? { message: parsed.data.message || null } : {}),
  };

  const nextType = payload.type ?? before.type;
  const nextOpen = payload.specialOpenTime ?? before.specialOpenTime;
  const nextClose = payload.specialCloseTime ?? before.specialCloseTime;

  if (nextType === "SPECIAL_HOURS" && (!nextOpen || !nextClose)) {
    return NextResponse.json({ error: "Special hours require open and close time" }, { status: 422 });
  }

  try {
    const updated = await db.parkHoliday.update({
      where: { id },
      data: payload,
    });

    invalidateSettingsCache();

    await logAudit({
      userId: user.id,
      userRole: user.role,
      action: "settings.update",
      entity: "ParkHoliday",
      entityId: id,
      oldValue: before,
      newValue: updated,
      ipAddress: getIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Holiday for this date already exists" }, { status: 409 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const before = await db.parkHoliday.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Holiday not found" }, { status: 404 });

  await db.parkHoliday.delete({ where: { id } });
  invalidateSettingsCache();

  await logAudit({
    userId: user.id,
    userRole: user.role,
    action: "settings.update",
    entity: "ParkHoliday",
    entityId: id,
    oldValue: before,
    newValue: null,
    ipAddress: getIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
