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

function parseRange(url: URL): { start: Date; end: Date; granularity: "hourly" | "daily" } {
  const preset = url.searchParams.get("preset") ?? "today";
  const now = new Date();

  let start = startOfDay(now);
  let end = endOfDay(now);
  let granularity: "hourly" | "daily" = "hourly";

  if (preset === "week") {
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day - 1));
    start = startOfDay(monday);
    end = endOfDay(now);
    granularity = "daily";
  }

  if (preset === "month") {
    start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    end = endOfDay(now);
    granularity = "daily";
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
    const diffDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    granularity = diffDays <= 1 ? "hourly" : "daily";
  }

  return { start, end, granularity };
}

function bucketKey(date: Date, granularity: "hourly" | "daily"): string {
  if (granularity === "hourly") {
    return `${String(date.getHours()).padStart(2, "0")}:00`;
  }
  return date.toISOString().slice(0, 10);
}

function bucketSortValue(label: string, granularity: "hourly" | "daily"): number {
  if (granularity === "hourly") {
    return Number(label.split(":")[0]);
  }
  return new Date(label).getTime();
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (getRole(session) !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { start, end, granularity } = parseRange(request.nextUrl);

  const bookings = await db.booking.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      status: { not: "CANCELLED" },
    },
    select: {
      createdAt: true,
      adults: true,
      children: true,
    },
  });

  const buckets = new Map<string, { adults: number; children: number }>();

  for (const booking of bookings) {
    const key = bucketKey(booking.createdAt, granularity);
    const current = buckets.get(key) ?? { adults: 0, children: 0 };
    current.adults += booking.adults;
    current.children += booking.children;
    buckets.set(key, current);
  }

  const series = Array.from(buckets.entries())
    .sort((a, b) => bucketSortValue(a[0], granularity) - bucketSortValue(b[0], granularity))
    .map(([label, values]) => ({
      label,
      adults: values.adults,
      children: values.children,
      total: values.adults + values.children,
    }));

  return NextResponse.json({
    granularity,
    series,
  });
}
