import { NextResponse } from "next/server";

import packageJson from "../../../../package.json";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

const startedAt = Date.now();

export async function GET(): Promise<NextResponse> {
  let dbStatus: "ok" | "error" = "ok";
  let redisStatus: "ok" | "error" = "ok";

  try {
    await db.parkConfig.findFirst({ select: { id: true } });
  } catch {
    dbStatus = "error";
  }

  try {
    const pong = await redis.ping();
    if (pong !== "PONG") {
      redisStatus = "error";
    }
  } catch {
    redisStatus = "error";
  }

  const uptime = Math.floor((Date.now() - startedAt) / 1000);
  const payload = {
    status: dbStatus === "ok" && redisStatus === "ok" ? "ok" : "error",
    db: dbStatus,
    redis: redisStatus,
    version: String((packageJson as { version?: string }).version ?? "1.0.0"),
    uptime,
  };

  if (payload.status !== "ok") {
    return NextResponse.json(payload, { status: 503 });
  }

  return NextResponse.json(payload, { status: 200 });
}
