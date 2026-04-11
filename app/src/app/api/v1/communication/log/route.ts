import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  channel: z.enum(["SMS", "WHATSAPP", "EMAIL"]).optional(),
  status: z.enum(["QUEUED", "SENT", "FAILED"]).optional(),
  search: z.string().trim().optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid query", errors: parsed.error.flatten() }, { status: 400 });
  }

  const { page, limit, channel, status, search } = parsed.data;

  const where = {
    ...(channel ? { channel } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { recipientMobile: { contains: search, mode: "insensitive" as const } },
            { recipientEmail: { contains: search, mode: "insensitive" as const } },
            { referenceId: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.communicationLog.findMany({
      where,
      include: {
        template: { select: { id: true, name: true, channel: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.communicationLog.count({ where }),
  ]);

  return NextResponse.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}
