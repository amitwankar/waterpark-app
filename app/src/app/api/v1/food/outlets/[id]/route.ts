import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/session";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  isOpen: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { id } = await params;

  const outlet = await db.foodOutlet.findUnique({
    where: { id },
    include: {
      categories: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            where: { isDeleted: false, isAvailable: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
      _count: { select: { orders: true } },
    },
  });

  if (!outlet) {
    return NextResponse.json({ error: "Outlet not found" }, { status: 404 });
  }

  return NextResponse.json(outlet);
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

  const outlet = await db.foodOutlet.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(outlet);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  await db.foodOutlet.update({
    where: { id },
    data: { isActive: false },
  });

  return new NextResponse(null, { status: 204 });
}
