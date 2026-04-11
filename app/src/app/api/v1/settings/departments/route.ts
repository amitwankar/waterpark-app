import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/session";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(1).max(40).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;

  const rows = await db.departmentMaster.findMany({
    where: { isDeleted: false },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const name = parsed.data.name;
  const code = parsed.data.code?.toUpperCase();

  const exists = await db.departmentMaster.findFirst({
    where: {
      isDeleted: false,
      OR: [{ name: { equals: name, mode: "insensitive" } }, ...(code ? [{ code }] : [])],
    },
    select: { id: true },
  });

  if (exists) {
    return NextResponse.json({ error: "Department already exists" }, { status: 409 });
  }

  const row = await db.departmentMaster.create({
    data: {
      name,
      code,
      isActive: parsed.data.isActive ?? true,
    },
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(row, { status: 201 });
}
