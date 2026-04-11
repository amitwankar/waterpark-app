import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUser, requireAdminOrEmployee } from "@/lib/rides";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdminOrEmployee(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (user?.role !== "ADMIN" && user?.subRole !== "MAINTENANCE_TECH") {
    return NextResponse.json({ message: "Only maintenance tech can accept" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);

  const workOrder = await db.workOrder.findFirst({ where: { id, isDeleted: false } });
  if (!workOrder) {
    return NextResponse.json({ message: "Work order not found" }, { status: 404 });
  }

  if (workOrder.status !== "OPEN") {
    return NextResponse.json({ message: "Only OPEN work orders can be accepted" }, { status: 400 });
  }

  const updated = await db.workOrder.update({
    where: { id },
    data: {
      status: "IN_PROGRESS",
      assignedTo: workOrder.assignedTo ?? user?.id ?? null,
    },
  });

  return NextResponse.json({ workOrder: updated });
}
