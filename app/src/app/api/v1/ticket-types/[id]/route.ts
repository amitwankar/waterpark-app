import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const nullableInt = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.number().int().nullable().optional(),
);

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  category: z.string().min(1).max(60).optional(),
  price: z.coerce.number().min(0).optional(),
  gstRate: z.coerce.number().min(0).max(100).optional(),
  minAge: z.coerce.number().int().min(0).nullable().optional(),
  maxAge: z.coerce.number().int().min(0).nullable().optional(),
  maxPerBooking: nullableInt,
  validDays: z.coerce.number().int().min(1).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  imageUrl: z.string().url().nullable().optional(),
  isActive: z.coerce.boolean().optional(),
  rideId: z.preprocess((value) => (value === "" ? null : value), z.string().cuid().nullable().optional()),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const type = await db.ticketType.findUnique({
    where: { id, isDeleted: false },
    include: {
      ride: {
        select: { id: true, name: true },
      },
    },
  });
  if (!type) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...type, category: type.rideId ? "Ride" : "General", price: Number(type.price), gstRate: Number(type.gstRate) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status: 401 });
  const { id } = await params;
  try {
    const body = patchSchema.parse(await req.json());
    const { category: _category, ...safeBody } = body as typeof body & { category?: string };
    const type = await db.ticketType.update({
      where: { id },
      data: safeBody,
      include: {
        ride: {
          select: { id: true, name: true },
        },
      },
    });
    return NextResponse.json({ ...type, category: type.rideId ? "Ride" : "General", price: Number(type.price), gstRate: Number(type.gstRate) });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 422 });
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status: 401 });
  const { id } = await params;
  // Soft-delete
  await db.ticketType.update({ where: { id }, data: { isDeleted: true, isActive: false } });
  return NextResponse.json({ ok: true });
}
