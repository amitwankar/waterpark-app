import Redis from "ioredis";

type RedisTxResult = Array<[null, number | string]>;

class LocalRedisMulti {
  private readonly actions: Array<() => Promise<[null, number | string]>> = [];

  constructor(private readonly client: LocalRedis) {}

  incr(key: string): this {
    this.actions.push(async () => [null, await this.client.incr(key)]);
    return this;
  }

  ttl(key: string): this {
    this.actions.push(async () => [null, await this.client.ttl(key)]);
    return this;
  }

  zremrangebyscore(key: string, min: number, max: number): this {
    this.actions.push(async () => [null, await this.client.zremrangebyscore(key, min, max)]);
    return this;
  }

  zadd(key: string, score: number, member: string): this {
    this.actions.push(async () => [null, await this.client.zadd(key, score, member)]);
    return this;
  }

  zcard(key: string): this {
    this.actions.push(async () => [null, await this.client.zcard(key)]);
    return this;
  }

  expire(key: string, seconds: number): this {
    this.actions.push(async () => [null, await this.client.expire(key, seconds)]);
    return this;
  }

  async exec(): Promise<RedisTxResult> {
    const out: RedisTxResult = [];
    for (const action of this.actions) {
      out.push(await action());
    }
    return out;
  }
}

class LocalRedis {
  private readonly kv = new Map<string, string>();
  private readonly list = new Map<string, string[]>();
  private readonly zsets = new Map<string, Map<string, number>>();
  private readonly expiry = new Map<string, number>();

  private purgeIfExpired(key: string): void {
    const expiresAt = this.expiry.get(key);
    if (!expiresAt) return;
    if (Date.now() < expiresAt) return;

    this.expiry.delete(key);
    this.kv.delete(key);
    this.list.delete(key);
    this.zsets.delete(key);
  }

  private getList(key: string): string[] {
    this.purgeIfExpired(key);
    const current = this.list.get(key);
    if (current) return current;
    const created: string[] = [];
    this.list.set(key, created);
    return created;
  }

  private getZset(key: string): Map<string, number> {
    this.purgeIfExpired(key);
    const current = this.zsets.get(key);
    if (current) return current;
    const created = new Map<string, number>();
    this.zsets.set(key, created);
    return created;
  }

  async get(key: string): Promise<string | null> {
    this.purgeIfExpired(key);
    return this.kv.get(key) ?? null;
  }

  async set(key: string, value: string | number, ...args: Array<string | number>): Promise<"OK"> {
    this.kv.set(key, String(value));

    if (args.length >= 2 && String(args[0]).toUpperCase() === "EX") {
      const seconds = Number(args[1] ?? 0);
      if (seconds > 0) {
        this.expiry.set(key, Date.now() + seconds * 1000);
      }
    }

    return "OK";
  }

  async ttl(key: string): Promise<number> {
    this.purgeIfExpired(key);
    const expiresAt = this.expiry.get(key);
    if (!expiresAt) {
      if (this.kv.has(key) || this.list.has(key) || this.zsets.has(key)) return -1;
      return -2;
    }

    const seconds = Math.ceil((expiresAt - Date.now()) / 1000);
    if (seconds <= 0) {
      this.purgeIfExpired(key);
      return -2;
    }
    return seconds;
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.purgeIfExpired(key);
    const exists = this.kv.has(key) || this.list.has(key) || this.zsets.has(key);
    if (!exists) return 0;
    this.expiry.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  async incr(key: string): Promise<number> {
    const current = Number(await this.get(key) ?? "0");
    const next = current + 1;
    this.kv.set(key, String(next));
    return next;
  }

  async incrby(key: string, amount: number): Promise<number> {
    const current = Number(await this.get(key) ?? "0");
    const next = current + amount;
    this.kv.set(key, String(next));
    return next;
  }

  async decrby(key: string, amount: number): Promise<number> {
    const current = Number(await this.get(key) ?? "0");
    const next = current - amount;
    this.kv.set(key, String(next));
    return next;
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      this.purgeIfExpired(key);
      if (this.kv.delete(key)) removed += 1;
      if (this.list.delete(key)) removed += 1;
      if (this.zsets.delete(key)) removed += 1;
      this.expiry.delete(key);
    }
    return removed;
  }

  async mget(keys: string[]): Promise<Array<string | null>> {
    return Promise.all(keys.map((key) => this.get(key)));
  }

  async ping(): Promise<"PONG"> {
    return "PONG";
  }

  async exists(key: string): Promise<number> {
    this.purgeIfExpired(key);
    return this.kv.has(key) || this.list.has(key) || this.zsets.has(key) ? 1 : 0;
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    const list = this.getList(key);
    for (const value of values) {
      list.unshift(value);
    }
    return list.length;
  }

  async lrange(key: string, start: number, end: number): Promise<string[]> {
    const list = this.getList(key);
    const normalizedStart = start < 0 ? Math.max(0, list.length + start) : start;
    const normalizedEnd = end < 0 ? list.length + end : end;
    if (normalizedStart > normalizedEnd || normalizedStart >= list.length) return [];
    return list.slice(normalizedStart, Math.min(normalizedEnd + 1, list.length));
  }

  async lrem(key: string, count: number, value: string): Promise<number> {
    const list = this.getList(key);
    let removed = 0;

    if (count === 0) {
      const next = list.filter((item) => {
        const match = item === value;
        if (match) removed += 1;
        return !match;
      });
      this.list.set(key, next);
      return removed;
    }

    const iterateForward = count > 0;
    const target = Math.abs(count);
    const next = [...list];

    if (iterateForward) {
      for (let i = 0; i < next.length && removed < target; i += 1) {
        if (next[i] === value) {
          next.splice(i, 1);
          removed += 1;
          i -= 1;
        }
      }
    } else {
      for (let i = next.length - 1; i >= 0 && removed < target; i -= 1) {
        if (next[i] === value) {
          next.splice(i, 1);
          removed += 1;
        }
      }
    }

    this.list.set(key, next);
    return removed;
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    const zset = this.getZset(key);
    const existed = zset.has(member);
    zset.set(member, score);
    return existed ? 0 : 1;
  }

  async zcard(key: string): Promise<number> {
    const zset = this.getZset(key);
    return zset.size;
  }

  async zrange(key: string, start: number, stop: number, withScores?: string): Promise<string[]> {
    const zset = this.getZset(key);
    const sorted = Array.from(zset.entries()).sort((a, b) => a[1] - b[1]);
    const values = sorted.slice(start, stop + 1);

    if (withScores?.toUpperCase() === "WITHSCORES") {
      const out: string[] = [];
      for (const [member, score] of values) {
        out.push(member, String(score));
      }
      return out;
    }

    return values.map(([member]) => member);
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<number> {
    const zset = this.getZset(key);
    let removed = 0;
    for (const [member, score] of Array.from(zset.entries())) {
      if (score >= min && score <= max) {
        zset.delete(member);
        removed += 1;
      }
    }
    return removed;
  }

  multi(): LocalRedisMulti {
    return new LocalRedisMulti(this);
  }

  on(_event: string, _callback: (...args: unknown[]) => void): this {
    return this;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __waterparkRedis: Redis | undefined;
  // eslint-disable-next-line no-var
  var __waterparkLocalRedis: LocalRedis | undefined;
}

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not configured");
  }

  const client = new Redis(url, {
    enableReadyCheck: true,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    retryStrategy: (attempt) => {
      if (attempt > 3) return null;
      return Math.min(attempt * 150, 1_000);
    },
  });

  client.on("error", () => {
    // keep local logs clean
  });

  return client;
}

const useLocalRedis =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.LOCAL_DISABLE_REDIS === "true";

export const redis: Redis = useLocalRedis
  ? ((globalThis.__waterparkLocalRedis ??= new LocalRedis()) as unknown as Redis)
  : (globalThis.__waterparkRedis ?? createRedisClient());

if (!useLocalRedis && process.env.NODE_ENV !== "production") {
  globalThis.__waterparkRedis = redis;
}

export const REDIS_KEYS = {
  otp: (mobile: string) => `otp:${mobile}`,
  otpRequestLimit: (mobile: string) => `otp:rate:${mobile}`,
  loginFailCount: (mobile: string) => `auth:login:fail:${mobile}`,
  loginLock: (mobile: string) => `auth:login:lock:${mobile}`,
} as const;

export const REDIS_TTL = {
  otp: 300,
  otpRateLimit: 600,
  loginLock: 1800,
} as const;

export async function incrementWithWindow(
  key: string,
  windowSeconds: number,
): Promise<{ count: number; ttl: number }> {
  const tx = redis.multi();
  tx.incr(key);
  tx.ttl(key);

  const result = await tx.exec();
  const count = Number(result?.[0]?.[1] ?? 0);
  const ttlRaw = Number(result?.[1]?.[1] ?? -1);

  if (count === 1 || ttlRaw < 0) {
    await redis.expire(key, windowSeconds);
  }

  const ttl = ttlRaw > 0 ? ttlRaw : windowSeconds;
  return { count, ttl };
}
