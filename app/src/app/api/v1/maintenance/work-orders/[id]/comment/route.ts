import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser, requireAdminOrEmployee } from "@/lib/rides";

const commentSchema = z.object({
  comment: z.string().trim().min(2).max(1000),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdminOrEmployee(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);
  const payload = await request.json().catch(() => null);
  const parsed = commentSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const workOrder = await db.workOrder.findFirst({ where: { id, isDeleted: false } });
  if (!workOrder) {
    return NextResponse.json({ message: "Work order not found" }, { status: 404 });
  }

  const commentLine = `COMMENT|${new Date().toISOString()}|${user?.id ?? "unknown"}|${parsed.data.comment}`;

  const updated = await db.workOrder.update({
    where: { id },
    data: {
      resolutionNotes: `${workOrder.resolutionNotes ?? ""}\n${commentLine}`.trim(),
    },
  });

  return NextResponse.json({ workOrder: updated });
}
