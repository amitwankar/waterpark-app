import { redis } from "@/lib/redis";

function toDateKey(visitDate: Date): string {
  return visitDate.toISOString().slice(0, 10);
}

export function getCapacityKey(visitDate: Date): string {
  return `park:capacity:${toDateKey(visitDate)}`;
}

export async function getCapacityCount(visitDate: Date): Promise<number> {
  const value = await redis.get(getCapacityKey(visitDate));
  return Number(value ?? 0);
}

export async function assertCapacityAvailable(args: {
  visitDate: Date;
  maxCapacity: number;
  pax: number;
  allowOverride?: boolean;
}): Promise<{ ok: boolean; currentCount: number; available: number }> {
  const currentCount = await getCapacityCount(args.visitDate);
  const available = Math.max(0, args.maxCapacity - currentCount);

  if (args.allowOverride) {
    return { ok: true, currentCount, available };
  }

  const hasSpace = currentCount + args.pax <= args.maxCapacity;
  return { ok: hasSpace, currentCount, available };
}

export async function incrementCapacity(visitDate: Date, pax: number): Promise<number> {
  const key = getCapacityKey(visitDate);
  return redis.incrby(key, pax);
}

export async function decrementCapacity(visitDate: Date, pax: number): Promise<number> {
  const key = getCapacityKey(visitDate);
  const next = await redis.decrby(key, pax);
  if (next <= 0) {
    await redis.del(key);
    return 0;
  }
  return next;
}

