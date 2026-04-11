import { randomUUID } from "crypto";

import { redis } from "@/lib/redis";

export interface RateLimitInput {
  endpoint: string;
  identifier: string;
  limit: number;
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSec: number;
}

function keyFor(endpoint: string, identifier: string): string {
  const safeEndpoint = endpoint.replace(/[^a-zA-Z0-9:_-]/g, "-");
  const safeIdentifier = identifier.replace(/[^a-zA-Z0-9:_-]/g, "-");
  return `rate:${safeEndpoint}:${safeIdentifier}`;
}

export async function checkRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - input.windowSec * 1000;
  const key = keyFor(input.endpoint, input.identifier);
  const member = `${now}-${randomUUID()}`;

  const tx = redis.multi();
  tx.zremrangebyscore(key, 0, windowStart);
  tx.zadd(key, now, member);
  tx.zcard(key);
  tx.expire(key, input.windowSec);
  await tx.exec();

  const count = await redis.zcard(key);

  const remaining = Math.max(0, input.limit - count);
  const allowed = count <= input.limit;

  let retryAfterSec = 0;
  if (!allowed) {
    const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
    const oldestScore = oldest.length >= 2 ? Number(oldest[1]) : now;
    const waitMs = oldestScore + input.windowSec * 1000 - now;
    retryAfterSec = Math.max(1, Math.ceil(waitMs / 1000));
  }

  return {
    allowed,
    count,
    remaining,
    retryAfterSec,
  };
}
