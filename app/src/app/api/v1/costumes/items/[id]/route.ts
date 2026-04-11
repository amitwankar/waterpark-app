import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const patchSchema = z.object({
  categoryId: z.string().min(1).optional(),
  tagNumber: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(120).optional(),
  size: z.enum(["XS", "S", "M", "L", "XL", "XXL", "KIDS_S", "KIDS_M", "KIDS_L"]).optional(),
  rentalRate: z.number().min(0).optional(),
  gstRate: z.number().min(0).max(100).optional(),
  availableQuantity: z.number().int().min(0).max(500).optional(),
  status: z.enum(["AVAILABLE", "RENTED", "RETURNED", "MAINTENANCE"]).optional(),
  notes: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

function normalizeBaseTag(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "-").replace(/-\d{3}$/i, "");
}

function nextTag(base: string, used: Set<string>, startAt = 1): string {
  let counter = startAt;
  while (counter <= 9999) {
    const candidate = `${base}-${String(counter).padStart(3, "0")}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    counter += 1;
  }
  throw new Error("Unable to generate unique tag number");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await db.costumeItem.findUnique({
    where: { id },
    include: {
      category: true,
      rentals: {
        orderBy: { rentedAt: "desc" },
        take: 10,
        include: { rentedBy: { select: { name: true } } },
      },
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  try {
    const body = patchSchema.parse(await req.json());
    const existing = await db.costumeItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const stockCode = existing.stockCode ?? `single:${existing.id}`;
    const item = await db.$transaction(async (tx) => {
      const updated = await tx.costumeItem.update({
        where: { id },
        data: {
          ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
          ...(body.tagNumber !== undefined ? { tagNumber: body.tagNumber.trim().toUpperCase() } : {}),
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.size !== undefined ? { size: body.size } : {}),
          ...(body.rentalRate !== undefined ? { rentalRate: body.rentalRate } : {}),
          ...(body.gstRate !== undefined ? { gstRate: body.gstRate } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          depositRate: 0,
          stockCode,
        },
      });

      if (typeof body.availableQuantity === "number") {
        const availableItems = await tx.costumeItem.findMany({
          where: { stockCode, isActive: true, status: "AVAILABLE" },
          orderBy: { createdAt: "desc" },
          select: { id: true, tagNumber: true },
        });
        const current = availableItems.length;
        const desired = body.availableQuantity;
        if (desired > current) {
          const delta = desired - current;
          const baseTag = normalizeBaseTag(body.tagNumber ?? existing.tagNumber);
          const existingTags = await tx.costumeItem.findMany({
            where: {
              OR: [{ tagNumber: baseTag }, { tagNumber: { startsWith: `${baseTag}-` } }],
            },
            select: { tagNumber: true },
          });
          const used = new Set(existingTags.map((row) => row.tagNumber.toUpperCase()));
          const tags: string[] = [];
          for (let i = 0; i < delta; i += 1) {
            tags.push(nextTag(baseTag, used, i + 1));
          }
          for (const tag of tags) {
            await tx.costumeItem.create({
              data: {
                categoryId: updated.categoryId,
                stockCode,
                tagNumber: tag,
                name: updated.name,
                size: updated.size,
                status: "AVAILABLE",
                rentalRate: updated.rentalRate,
                depositRate: 0,
                gstRate: updated.gstRate,
                isActive: true,
                notes: updated.notes,
              },
            });
          }
        } else if (desired < current) {
          const delta = current - desired;
          const candidates = availableItems.map((row) => row.id);
          const removable = candidates.slice(0, delta);
          if (removable.length < delta) {
            throw new Error("CANNOT_REDUCE_QUANTITY");
          }
          if (removable.length > 0) {
            await tx.costumeItem.updateMany({
              where: { id: { in: removable } },
              data: { isActive: false, status: "MAINTENANCE" },
            });
          }
        }
      }

      return updated;
    });
    return NextResponse.json(item);
  } catch (e) {
    if (e instanceof Error && e.message === "CANNOT_REDUCE_QUANTITY") {
      return NextResponse.json(
        { error: "Cannot reduce quantity further with current active available stock." },
        { status: 409 },
      );
    }
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 422 });
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;

  const activeRental = await db.costumeRental.findFirst({
    where: { costumeItemId: id, returnedAt: null },
    select: { id: true },
  });
  if (activeRental) {
    return NextResponse.json({ error: "Cannot delete item with active rental" }, { status: 409 });
  }

  await db.costumeItem.update({
    where: { id },
    data: {
      isActive: false,
      status: "MAINTENANCE",
    },
  });
  return NextResponse.json({ ok: true });
}
