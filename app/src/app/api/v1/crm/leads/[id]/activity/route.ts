import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const activitySchema = z.object({
  activityType: z.enum(["CALL", "EMAIL", "WHATSAPP", "MEETING", "NOTE"]),
  notes: z.string().trim().min(1).max(2000),
});

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

function getUserId(session: unknown): string | null {
  const candidate = session as { user?: { id?: string } };
  return candidate?.user?.id ?? null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  const role = getRole(session);
  if (role !== "ADMIN" && role !== "EMPLOYEE") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const userId = getUserId(session);
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await Promise.resolve(context.params);
  const lead = await db.lead.findFirst({ where: { id, isDeleted: false }, select: { id: true } });
  if (!lead) {
    return NextResponse.json({ message: "Lead not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = activitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const activity = await db.leadActivity.create({
    data: {
      leadId: lead.id,
      activityType: parsed.data.activityType,
      notes: parsed.data.notes,
      performedBy: userId,
    },
    include: {
      performer: { select: { id: true, name: true, mobile: true } },
    },
  });

  return NextResponse.json({ activity }, { status: 201 });
}
