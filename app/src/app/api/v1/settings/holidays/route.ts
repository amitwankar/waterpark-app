import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getIp, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { invalidateSettingsCache } from "@/lib/settings";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(2).max(120),
  type: z.enum(["CLOSED", "SPECIAL_HOURS", "SPECIAL_EVENT"]),
  specialOpenTime: z.string().regex(timeRegex).optional().or(z.literal("")),
  specialCloseTime: z.string().regex(timeRegex).optional().or(z.literal("")),
  message: z.string().trim().max(500).optional().or(z.literal("")),
});

function toDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const startDate = start ? toDateOnly(String(start)) : undefined;
  const endDate = end ? toDateOnly(String(end)) : undefined;

  const where = {
    ...(startDate || endDate
      ? {
          date: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {}),
  };

  const rows = await db.parkHoliday.findMany({
    where,
    orderBy: { date: "asc" },
  });

  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  if (parsed.data.type === "SPECIAL_HOURS" && (!parsed.data.specialOpenTime || !parsed.data.specialCloseTime)) {
    return NextResponse.json({ error: "Special hours require open and close time" }, { status: 422 });
  }

  const payload = {
    date: toDateOnly(String(parsed.data.date)),
    name: parsed.data.name,
    type: parsed.data.type,
    specialOpenTime: parsed.data.specialOpenTime || null,
    specialCloseTime: parsed.data.specialCloseTime || null,
    message: parsed.data.message || null,
  };

  try {
    const created = await db.parkHoliday.create({ data: payload });
    invalidateSettingsCache();

    await logAudit({
      userId: user.id,
      userRole: user.role,
      action: "settings.update",
      entity: "ParkHoliday",
      entityId: created.id,
      oldValue: null,
      newValue: payload,
      ipAddress: getIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Holiday for this date already exists" }, { status: 409 });
  }
}
