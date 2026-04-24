import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const updateSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  email: z.string().email().nullable().optional(),
  subRole: z
    .enum([
      "TICKET_COUNTER",
      "FB_STAFF",
      "RIDE_OPERATOR",
      "MAINTENANCE_TECH",
      "LOCKER_ATTENDANT",
      "COSTUME_ATTENDANT",
      "PARKING_ATTENDANT",
      "SALES_EXECUTIVE",
      "SECURITY_STAFF",
      "EVENT_COORDINATOR",
    ])
    .optional(),
  isActive: z.boolean().optional(),
  department: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const staff = await db.user.findFirst({
    where: { id, role: "EMPLOYEE", isDeleted: false },
    select: {
      id: true,
      name: true,
      mobile: true,
      email: true,
      subRole: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      staffProfile: {
        include: {
          shifts: {
            orderBy: { shiftDate: "desc" },
            take: 10,
          },
        },
      },
    },
  });

  if (!staff) {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  }

  return NextResponse.json(staff);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const { department, ...userFields } = parsed.data;

  if (department?.trim()) {
    const departmentExists = await db.departmentMaster.findFirst({
      where: {
        name: { equals: department.trim(), mode: "insensitive" },
        isDeleted: false,
        isActive: true,
      },
      select: { id: true },
    });

    if (!departmentExists) {
      return NextResponse.json({ error: "Invalid department" }, { status: 422 });
    }
  }

  const existing = await db.user.findFirst({
    where: { id, role: "EMPLOYEE", isDeleted: false },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  }

  const user = await db.user.update({
    where: { id },
    data: {
      ...userFields,
      ...(department !== undefined
        ? { staffProfile: { update: { department: department?.trim() || null } } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      mobile: true,
      email: true,
      subRole: true,
      isActive: true,
      staffProfile: true,
    },
  });

  return NextResponse.json(user);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  if (user.id === id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 409 });
  }

  const target = await db.user.findFirst({
    where: { id, role: "EMPLOYEE", isDeleted: false },
    select: { id: true },
  });

  if (!target) {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  }

  try {
    await db.user.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        {
          error:
            "Cannot permanently delete this staff account because historical records are linked to it. Keep it deactivated instead.",
        },
        { status: 409 }
      );
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}
