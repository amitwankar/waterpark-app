import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") ?? "20")));
  const action = searchParams.get("action")?.trim();
  const entity = searchParams.get("entity")?.trim();
  const userId = searchParams.get("userId")?.trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where = {
    ...(action ? { action: { contains: action, mode: "insensitive" as const } } : {}),
    ...(entity ? { entity: { contains: entity, mode: "insensitive" as const } } : {}),
    ...(userId ? { userId } : {}),
    ...((from || to)
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.auditLog.count({ where }),
  ]);

  return NextResponse.json({ rows, total, page, pageSize });
}
