import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser, requireAdminOrEmployee } from "@/lib/rides";

const workOrderPriorities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

const createWorkOrderSchema = z.object({
  assetId: z.string().cuid(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(3).max(3000),
  priority: z.enum(workOrderPriorities),
  assignedTo: z.string().cuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  estimatedCost: z.number().min(0).optional(),
  linkedRideId: z.string().cuid().optional().nullable(),
  attachments: z.array(z.string().trim().max(500)).max(5).optional(),
});

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  priority: z.enum(["ALL", ...workOrderPriorities]).default("ALL"),
  status: z.enum(["ALL", "OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("ALL"),
  assignedTo: z.string().trim().optional(),
  overdue: z.enum(["0", "1"]).optional(),
  search: z.string().trim().optional(),
});

function getDefaultDueDate(priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"): Date {
  const now = new Date();
  if (priority === "CRITICAL") return now;
  if (priority === "HIGH") return new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  if (priority === "MEDIUM") return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function workOrderNumber(id: string): string {
  return `WO-${id.slice(-6).toUpperCase()}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsedQuery = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsedQuery.success) {
    return NextResponse.json({ message: "Invalid query", errors: parsedQuery.error.flatten() }, { status: 400 });
  }

  const { page, limit, priority, status, assignedTo, overdue, search } = parsedQuery.data;
  const now = new Date();

  const where: Prisma.WorkOrderWhereInput = {
    isDeleted: false,
    ...(priority !== "ALL" ? { priority } : {}),
    ...(status !== "ALL" ? { status } : {}),
    ...(assignedTo ? { assignedTo } : {}),
    ...(overdue === "1"
      ? {
          dueDate: { lt: now },
          status: { in: ["OPEN", "IN_PROGRESS"] },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
            { asset: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.workOrder.findMany({
      where,
      include: {
        asset: { select: { id: true, name: true, assetType: true, location: true } },
        assignee: { select: { id: true, name: true, mobile: true } },
        creator: { select: { id: true, name: true } },
        ride: { select: { id: true, name: true, status: true } },
      },
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.workOrder.count({ where }),
  ]);

  return NextResponse.json({
    items: items.map((item: any) => ({
      ...item,
      workOrderNumber: workOrderNumber(item.id),
      isOverdue:
        !!item.dueDate && item.dueDate.getTime() < now.getTime() && ["OPEN", "IN_PROGRESS"].includes(item.status),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdminOrEmployee(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = createWorkOrderSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const asset = await db.maintenanceAsset.findFirst({ where: { id: parsed.data.assetId, isDeleted: false } });
  if (!asset) {
    return NextResponse.json({ message: "Asset not found" }, { status: 404 });
  }

  const assignee = parsed.data.assignedTo
    ? await db.user.findFirst({
        where: {
          id: parsed.data.assignedTo,
          isDeleted: false,
          role: { in: ["ADMIN", "EMPLOYEE"] },
        },
      })
    : null;

  if (parsed.data.assignedTo && !assignee) {
    return NextResponse.json({ message: "Assignee not found" }, { status: 404 });
  }

  const descriptionLines = [
    parsed.data.description,
    parsed.data.estimatedCost !== undefined ? `ESTIMATED_COST:${parsed.data.estimatedCost}` : null,
    parsed.data.attachments?.length ? `ATTACHMENTS:${JSON.stringify(parsed.data.attachments)}` : null,
  ].filter(Boolean) as string[];

  const workOrder = await db.workOrder.create({
    data: {
      assetId: parsed.data.assetId,
      rideId: parsed.data.linkedRideId ?? null,
      title: parsed.data.title,
      description: descriptionLines.join("\n"),
      priority: parsed.data.priority,
      status: "OPEN",
      assignedTo: parsed.data.assignedTo ?? null,
      dueDate: parseDate(parsed.data.dueDate) ?? getDefaultDueDate(parsed.data.priority),
      createdBy: user?.id ?? "",
    },
    include: {
      asset: { select: { id: true, name: true, assetType: true } },
      assignee: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(
    {
      workOrder: {
        ...workOrder,
        workOrderNumber: workOrderNumber(workOrder.id),
      },
    },
    { status: 201 },
  );
}
