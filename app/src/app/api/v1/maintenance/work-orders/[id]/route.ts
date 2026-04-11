import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser, requireAdminOrEmployee } from "@/lib/rides";

const updateSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(3).max(3000).optional(),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  assignedTo: z.string().cuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  cancelReason: z.string().trim().min(3).max(500).optional(),
});

function workOrderNumber(id: string): string {
  return `WO-${id.slice(-6).toUpperCase()}`;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const { id } = await Promise.resolve(context.params);

  const workOrder = await db.workOrder.findFirst({
    where: { id, isDeleted: false },
    include: {
      asset: true,
      ride: { select: { id: true, name: true, status: true } },
      assignee: { select: { id: true, name: true, mobile: true, subRole: true } },
      creator: { select: { id: true, name: true, mobile: true } },
    },
  });

  if (!workOrder) {
    return NextResponse.json({ message: "Work order not found" }, { status: 404 });
  }

  return NextResponse.json({
    workOrder: {
      ...workOrder,
      workOrderNumber: workOrderNumber(workOrder.id),
      comments: (workOrder.resolutionNotes ?? "")
        .split("\n")
        .filter((line: string) => line.startsWith("COMMENT|"))
        .map((line: string) => {
          const [, ts, name, text] = line.split("|");
          return { timestamp: ts, name, text };
        }),
    },
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdminOrEmployee(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);
  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.workOrder.findFirst({ where: { id, isDeleted: false } });
  if (!existing) {
    return NextResponse.json({ message: "Work order not found" }, { status: 404 });
  }

  if (parsed.data.status === "CANCELLED" && user?.role !== "ADMIN") {
    return NextResponse.json({ message: "Only admin can cancel work orders" }, { status: 403 });
  }

  const resolutionNotes =
    parsed.data.status === "CANCELLED"
      ? `${existing.resolutionNotes ?? ""}\nCANCEL_REASON:${parsed.data.cancelReason ?? "Cancelled by admin"}`.trim()
      : existing.resolutionNotes;

  const updated = await db.workOrder.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.assignedTo !== undefined ? { assignedTo: parsed.data.assignedTo ?? null } : {}),
      ...(parsed.data.dueDate !== undefined ? { dueDate: parseDate(parsed.data.dueDate) } : {}),
      ...(parsed.data.status === "COMPLETED" ? { completedAt: new Date() } : {}),
      ...(parsed.data.status === "OPEN" ? { completedAt: null } : {}),
      ...(parsed.data.status === "CANCELLED" ? { resolutionNotes } : {}),
    },
    include: {
      asset: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
      ride: { select: { id: true, name: true, status: true } },
    },
  });

  return NextResponse.json({
    workOrder: {
      ...updated,
      workOrderNumber: workOrderNumber(updated.id),
    },
  });
}
