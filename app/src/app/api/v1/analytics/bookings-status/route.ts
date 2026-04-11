import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function parseRange(url: URL): { start: Date; end: Date } {
  const preset = url.searchParams.get("preset") ?? "today";
  const now = new Date();

  let start = startOfDay(now);
  let end = endOfDay(now);

  if (preset === "week") {
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day - 1));
    start = startOfDay(monday);
    end = endOfDay(now);
  }

  if (preset === "month") {
    start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    end = endOfDay(now);
  }

  if (preset === "custom") {
    const startRaw = url.searchParams.get("start");
    const endRaw = url.searchParams.get("end");
    if (startRaw && endRaw) {
      const customStart = new Date(startRaw);
      const customEnd = new Date(endRaw);
      if (!Number.isNaN(customStart.getTime()) && !Number.isNaN(customEnd.getTime())) {
        start = startOfDay(customStart);
        end = endOfDay(customEnd);
      }
    }
  }

  return { start, end };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (getRole(session) !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { start, end } = parseRange(request.nextUrl);

  const statuses = [
    "CONFIRMED",
    "PENDING",
    "PARTIALLY_PAID",
    "CHECKED_IN",
    "CANCELLED",
    "COMPLETED",
  ] as const;

  const counts = await Promise.all(
    statuses.map((status) =>
      db.booking.count({
        where: {
          status: status as any,
          createdAt: { gte: start, lte: end },
        },
      }),
    ),
  );

  return NextResponse.json({
    items: statuses.map((status, index) => ({
      status,
      count: counts[index],
    })),
    total: counts.reduce((acc, value) => acc + value, 0),
  });
}
