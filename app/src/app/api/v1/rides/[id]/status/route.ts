import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { createMaintenanceWorkOrderForRide, getSessionUser, requireAdminOrEmployee } from "@/lib/rides";

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "MAINTENANCE", "CLOSED", "SEASONAL"]),
  reason: z.string().trim().min(2).max(500).optional(),
  autoCreateWorkOrder: z.boolean().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdminOrEmployee(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);
  const body = await request.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const ride = await db.ride.findUnique({ where: { id } });
  if (!ride || ride.isDeleted) {
    return NextResponse.json({ message: "Ride not found" }, { status: 404 });
  }

  if ((parsed.data.status === "MAINTENANCE" || parsed.data.status === "CLOSED") && !parsed.data.reason) {
    return NextResponse.json({ message: "Reason is required for this status" }, { status: 400 });
  }

  let createdWorkOrderId: string | null = null;

  if (parsed.data.status === "MAINTENANCE") {
    const shouldAuto = parsed.data.autoCreateWorkOrder ?? true;
    if (shouldAuto) {
      createdWorkOrderId = await createMaintenanceWorkOrderForRide({
        rideId: ride.id,
        rideName: ride.name,
        reason: parsed.data.reason ?? "Maintenance required",
        createdBy: user?.id ?? "",
        priority: parsed.data.priority,
      });
    } else {
      const openWoCount = await db.workOrder.count({
        where: { rideId: ride.id, isDeleted: false, status: { in: ["OPEN", "IN_PROGRESS"] } },
      });
      if (openWoCount === 0) {
        return NextResponse.json(
          { message: "Maintenance status requires at least one open work order" },
          { status: 400 },
        );
      }
    }
  }

  const nextNotes = parsed.data.reason
    ? `${(ride.description ?? "").trim()}\nSTATUS_REASON:${new Date().toISOString()}|${parsed.data.status}|${parsed.data.reason}`.trim()
    : ride.description;

  const updated = await db.ride.update({
    where: { id: ride.id },
    data: {
      status: parsed.data.status as any,
      description: nextNotes,
    },
  });

  return NextResponse.json({ ride: updated, workOrderId: createdWorkOrderId });
}
