import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser, requireAdminOrEmployee } from "@/lib/rides";

const completeSchema = z.object({
  resolutionNotes: z.string().trim().min(3).max(4000),
  actualCost: z.number().min(0).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdminOrEmployee(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (user?.role !== "ADMIN" && user?.subRole !== "MAINTENANCE_TECH") {
    return NextResponse.json({ message: "Only maintenance tech/admin can complete" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);
  const payload = await request.json().catch(() => null);
  const parsed = completeSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const workOrder = await db.workOrder.findFirst({ where: { id, isDeleted: false } });
  if (!workOrder) {
    return NextResponse.json({ message: "Work order not found" }, { status: 404 });
  }

  if (!["OPEN", "IN_PROGRESS"].includes(workOrder.status)) {
    return NextResponse.json({ message: "Work order cannot be completed" }, { status: 400 });
  }

  const notes = [
    workOrder.resolutionNotes,
    parsed.data.resolutionNotes,
    parsed.data.actualCost !== undefined ? `ACTUAL_COST:${parsed.data.actualCost}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const updated = await db.workOrder.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      resolutionNotes: notes,
      assignedTo: workOrder.assignedTo ?? user?.id ?? null,
    },
    include: {
      ride: { select: { id: true, name: true } },
    },
  });

  if (updated.rideId) {
    await db.ride.update({
      where: { id: updated.rideId },
      data: { status: "ACTIVE" },
    }).catch(() => null);
  }

  return NextResponse.json({ workOrder: updated });
}
