import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  category: z.string().min(1).max(60).optional(),
  price: z.number().min(0).optional(),
  gstRate: z.number().min(0).max(100).optional(),
  minAge: z.number().int().min(0).nullable().optional(),
  maxAge: z.number().int().min(0).nullable().optional(),
  maxPerBooking: z.number().int().min(1).nullable().optional(),
  validDays: z.number().int().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
  imageUrl: z.string().url().nullable().optional(),
  isActive: z.boolean().optional(),
  rideId: z.string().cuid().nullable().optional(),
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
  return NextResponse.json({ ...type, price: Number(type.price), gstRate: Number(type.gstRate) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status: 401 });
  const { id } = await params;
  try {
    const body = patchSchema.parse(await req.json());
    const type = await db.ticketType.update({
      where: { id },
      data: body,
      include: {
        ride: {
          select: { id: true, name: true },
        },
      },
    });
    return NextResponse.json({ ...type, price: Number(type.price), gstRate: Number(type.gstRate) });
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
