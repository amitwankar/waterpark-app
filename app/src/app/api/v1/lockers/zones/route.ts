import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/session";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().optional(),
});

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;

  const zones = await db.lockerZone.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { lockers: true } },
    },
  });

  return NextResponse.json(zones);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const zone = await db.lockerZone.create({ data: parsed.data });
  return NextResponse.json(zone, { status: 201 });
}
