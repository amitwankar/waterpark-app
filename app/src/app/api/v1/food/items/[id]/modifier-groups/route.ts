import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireStaff, requireSubRole } from "@/lib/session";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(1).default(1),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { id } = await params;
  const groups = await db.foodModifierGroup.findMany({
    where: { foodItemId: id, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      options: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  return NextResponse.json(groups);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireSubRole("FB_STAFF");
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  if (parsed.data.minSelect > parsed.data.maxSelect) {
    return NextResponse.json(
      { error: "minSelect cannot be greater than maxSelect" },
      { status: 422 },
    );
  }

  const item = await db.foodItem.findFirst({
    where: { id, isDeleted: false },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Food item not found" }, { status: 404 });
  }

  const row = await db.foodModifierGroup.create({
    data: {
      foodItemId: id,
      ...parsed.data,
    },
    include: {
      options: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  return NextResponse.json(row, { status: 201 });
}
