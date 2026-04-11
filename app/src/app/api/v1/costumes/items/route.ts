import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const createSchema = z.object({
  categoryId: z.string().min(1),
  tagNumber: z.string().min(1).max(50),
  name: z.string().min(1).max(120),
  size: z.enum(["XS", "S", "M", "L", "XL", "XXL", "KIDS_S", "KIDS_M", "KIDS_L"]),
  rentalRate: z.number().min(0),
  gstRate: z.number().min(0).max(100).default(0),
  availableQuantity: z.number().int().min(1).max(500).default(1),
  notes: z.string().max(500).optional(),
});

function normalizeBaseTag(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "-").replace(/-\d{3}$/i, "");
}

function deriveLegacyGroupKey(item: {
  stockCode: string | null;
  categoryId: string;
  name: string;
  size: string;
  rentalRate: number | { toString(): string };
  gstRate: number | { toString(): string };
  tagNumber: string;
}): string {
  if (item.stockCode && item.stockCode.trim().length > 0) {
    return `stock:${item.stockCode}`;
  }
  const baseTag = normalizeBaseTag(item.tagNumber);
  return [
    "legacy",
    item.categoryId,
    item.name.trim().toLowerCase(),
    item.size,
    Number(item.rentalRate).toFixed(2),
    Number(item.gstRate).toFixed(2),
    baseTag,
  ].join("|");
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  const status = searchParams.get("status");
  const availableOnly = searchParams.get("availableOnly") === "true";

  const items = await db.costumeItem.findMany({
    where: {
      isActive: true,
      ...(categoryId ? { categoryId } : {}),
      ...(availableOnly ? { status: "AVAILABLE" } : status ? { status: status as never } : {}),
    },
    include: { category: { select: { id: true, name: true } } },
    orderBy: [{ name: "asc" }],
  });
  const keyFor = (item: (typeof items)[number]) => deriveLegacyGroupKey(item);
  const availableByKey = new Map<string, number>();
  for (const item of items) {
    const key = keyFor(item);
    if (item.status === "AVAILABLE" && item.isActive) {
      availableByKey.set(key, (availableByKey.get(key) ?? 0) + 1);
    }
  }
  return NextResponse.json(
    items.map((item) => ({
      ...item,
      availableQuantity: availableByKey.get(keyFor(item)) ?? 0,
    })),
  );
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  try {
    const body = createSchema.parse(await req.json());
    const quantity = Math.max(1, body.availableQuantity ?? 1);
    const baseTag = normalizeBaseTag(body.tagNumber);
    const stockCode = `STK-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const existing = await db.costumeItem.findMany({
      where: {
        OR: [{ tagNumber: baseTag }, { tagNumber: { startsWith: `${baseTag}-` } }],
      },
      select: { tagNumber: true },
    });
    const used = new Set(existing.map((row) => row.tagNumber.toUpperCase()));
    const tags: string[] = [];
    if (quantity === 1 && !used.has(baseTag)) {
      used.add(baseTag);
      tags.push(baseTag);
    } else {
      for (let i = 0; i < quantity; i += 1) {
        tags.push(nextTag(baseTag, used, i + 1));
      }
    }

    const created = await db.$transaction(
      tags.map((tag) =>
        db.costumeItem.create({
          data: {
            categoryId: body.categoryId,
            stockCode,
            tagNumber: tag,
            name: body.name,
            size: body.size,
            rentalRate: body.rentalRate,
            depositRate: 0,
            gstRate: body.gstRate,
            notes: body.notes,
          },
        }),
      ),
    );
    return NextResponse.json(
      {
        createdCount: created.length,
        stockCode,
        items: created,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 422 });
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}
