import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireStaff, requireSubRole } from "@/lib/session";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  price: z.number().min(0),
  sortOrder: z.number().int().default(0),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> },
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { groupId } = await params;
  const options = await db.foodModifierOption.findMany({
    where: { groupId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(options);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> },
) {
  const { error } = await requireSubRole("FB_STAFF");
  if (error) return error;

  const { id, groupId } = await params;
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const group = await db.foodModifierGroup.findFirst({
    where: { id: groupId, foodItemId: id, isActive: true },
    select: { id: true },
  });
  if (!group) {
    return NextResponse.json({ error: "Modifier group not found" }, { status: 404 });
  }

  if (parsed.data.isDefault) {
    await db.foodModifierOption.updateMany({
      where: { groupId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const row = await db.foodModifierOption.create({
    data: {
      groupId,
      ...parsed.data,
    },
  });

  return NextResponse.json(row, { status: 201 });
}
