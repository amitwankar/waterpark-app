import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser, requireAdmin } from "@/lib/rides";

const reopenSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdmin(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);
  const payload = await request.json().catch(() => null);
  const parsed = reopenSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const workOrder = await db.workOrder.findFirst({ where: { id, isDeleted: false } });
  if (!workOrder) {
    return NextResponse.json({ message: "Work order not found" }, { status: 404 });
  }

  if (workOrder.status !== "COMPLETED") {
    return NextResponse.json({ message: "Only completed work orders can be reopened" }, { status: 400 });
  }

  const updated = await db.workOrder.update({
    where: { id },
    data: {
      status: "OPEN",
      completedAt: null,
      resolutionNotes: `${workOrder.resolutionNotes ?? ""}\nREOPEN_REASON:${parsed.data.reason}`.trim(),
    },
  });

  return NextResponse.json({ workOrder: updated });
}
