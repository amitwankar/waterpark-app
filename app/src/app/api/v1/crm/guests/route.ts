import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const TIERS = ["BRONZE", "SILVER", "GOLD", "PLATINUM"] as const;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  tier: z.enum(TIERS).optional(),
  tags: z.string().trim().optional(),
  sort: z.enum(["lastVisit", "spend", "points", "name"]).default("lastVisit"),
  order: z.enum(["asc", "desc"]).default("desc"),
  export: z.enum(["csv"]).optional(),
});

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

function toCsv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) return "Name,Mobile,Tier,Visits,Spend,Points,Last Visit,Tags\n";
  const headers = Object.keys(rows[0]);
  const escapeCell = (value: string | number): string => {
    const text = String(value ?? "");
    if (text.includes(",") || text.includes("\n") || text.includes('"')) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCell(row[header] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  const role = getRole(session);
  if (role !== "ADMIN" && role !== "EMPLOYEE") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid query", errors: parsed.error.flatten() }, { status: 400 });
  }

  const query = parsed.data;
  const tags = query.tags ? query.tags.split(",").map((item: string) => item.trim()).filter(Boolean) : [];

  const where: any = {
    ...(query.tier ? { tier: query.tier } : {}),
    ...(tags.length > 0 ? { tags: { hasSome: tags } } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { mobile: { contains: query.search } },
            { email: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orderBy: any =
    query.sort === "name"
      ? { name: query.order }
      : query.sort === "points"
      ? { loyaltyPoints: query.order }
      : query.sort === "spend"
      ? { totalSpend: query.order }
      : { lastVisitDate: query.order };

  const [total, rows] = await Promise.all([
    db.guestProfile.count({ where }),
    db.guestProfile.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        name: true,
        mobile: true,
        email: true,
        tier: true,
        totalVisits: true,
        totalSpend: true,
        loyaltyPoints: true,
        lastVisitDate: true,
        tags: true,
      },
    }),
  ]);

  if (query.export === "csv") {
    const csv = toCsv(
      rows.map((row: any) => ({
        Name: row.name,
        Mobile: row.mobile,
        Tier: row.tier,
        Visits: row.totalVisits,
        Spend: Number(row.totalSpend),
        Points: row.loyaltyPoints,
        "Last Visit": row.lastVisitDate ? row.lastVisitDate.toISOString().slice(0, 10) : "",
        Tags: row.tags.join(" | "),
      })),
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="crm-guests-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const allTags = await db.guestProfile.findMany({ select: { tags: true } });
  const tagCounts = new Map<string, number>();
  for (const row of allTags) {
    for (const tag of row.tags) {
      if (!tag.startsWith("__note:")) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    items: rows.map((row: any) => ({ ...row, totalSpend: Number(row.totalSpend) })),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
    filters: {
      tiers: TIERS,
      tags: Array.from(tagCounts.entries()).map(([name, count]) => ({ name, count })),
    },
  });
}
