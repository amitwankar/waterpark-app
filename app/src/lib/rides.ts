import { randomUUID } from "crypto";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

export type RideStatusValue = "ACTIVE" | "MAINTENANCE" | "CLOSED" | "SEASONAL";
export type QueueAction = "INCREMENT" | "DECREMENT" | "SET" | "RESET";

export interface SessionUserMeta {
  id: string;
  role: string;
  subRole: string | null;
}

export function queueKey(rideId: string): string {
  return `ride:${rideId}:queue`;
}

export function calcWaitTimeMinutes(queueCount: number, avgDurationMin: number): number {
  return Math.max(0, queueCount) * Math.max(1, avgDurationMin);
}

export async function getSessionUser(headers: Headers): Promise<SessionUserMeta | null> {
  const session = await auth.api.getSession({ headers });
  const candidate = session as { user?: { id?: string; role?: string; subRole?: string | null } };
  if (!candidate?.user?.id) return null;
  return {
    id: candidate.user.id,
    role: String(candidate.user.role ?? "USER"),
    subRole: candidate.user.subRole ?? null,
  };
}

export function requireAdminOrEmployee(user: SessionUserMeta | null): boolean {
  if (!user) return false;
  return user.role === "ADMIN" || user.role === "EMPLOYEE";
}

export function requireAdmin(user: SessionUserMeta | null): boolean {
  return !!user && user.role === "ADMIN";
}

export async function getQueueCount(rideId: string): Promise<number> {
  const raw = await redis.get(queueKey(rideId));
  const parsed = Number(raw ?? "0");
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export async function updateQueueCount(rideId: string, action: QueueAction, value?: number): Promise<number> {
  const key = queueKey(rideId);

  if (action === "RESET") {
    await redis.set(key, 0);
    return 0;
  }

  if (action === "SET") {
    const next = Math.max(0, Math.floor(value ?? 0));
    await redis.set(key, next);
    return next;
  }

  if (action === "INCREMENT") {
    const next = await redis.incr(key);
    return Math.max(0, Number(next));
  }

  const current = await getQueueCount(rideId);
  const next = Math.max(0, current - 1);
  await redis.set(key, next);
  return next;
}

export async function incrementQueueBy(rideId: string, amount: number): Promise<number> {
  const safeAmount = Math.max(0, Math.floor(amount));
  if (safeAmount <= 0) {
    return getQueueCount(rideId);
  }

  const current = await getQueueCount(rideId);
  const next = current + safeAmount;
  await redis.set(queueKey(rideId), next);
  return next;
}

export async function decrementQueueBy(rideId: string, amount: number): Promise<number> {
  const safeAmount = Math.max(0, Math.floor(amount));
  if (safeAmount <= 0) {
    return getQueueCount(rideId);
  }

  const current = await getQueueCount(rideId);
  const next = Math.max(0, current - safeAmount);
  await redis.set(queueKey(rideId), next);
  return next;
}

export async function listRideQueueSnapshot(rideIds: string[]): Promise<Record<string, number>> {
  if (rideIds.length === 0) return {};
  const keys = rideIds.map((rideId) => queueKey(rideId));
  const values = await redis.mget(keys);
  const out: Record<string, number> = {};
  rideIds.forEach((rideId, idx) => {
    const parsed = Number(values[idx] ?? "0");
    out[rideId] = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  });
  return out;
}

export async function ensureRideAsset(rideId: string, rideName: string): Promise<string> {
  const existing = await db.maintenanceAsset.findFirst({
    where: {
      isDeleted: false,
      OR: [
        { serialNumber: `RIDE-${rideId}` },
        { name: `Ride Asset - ${rideName}` },
      ],
    },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await db.maintenanceAsset.create({
    data: {
      name: `Ride Asset - ${rideName}`,
      assetType: "RIDE",
      serialNumber: `RIDE-${rideId}`,
      location: "Waterpark",
      isActive: true,
    },
    select: { id: true },
  });

  return created.id;
}

export async function createMaintenanceWorkOrderForRide(input: {
  rideId: string;
  rideName: string;
  reason: string;
  createdBy: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}): Promise<string> {
  const assetId = await ensureRideAsset(input.rideId, input.rideName);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);

  const workOrder = await db.workOrder.create({
    data: {
      assetId,
      rideId: input.rideId,
      title: `Ride Maintenance: ${input.rideName}`,
      description: `Auto-created from ride status update. Reason: ${input.reason}`,
      priority: input.priority ?? "MEDIUM",
      status: "OPEN",
      dueDate,
      createdBy: input.createdBy,
    },
    select: { id: true },
  });

  return workOrder.id;
}

export function parseInspectionWorkOrderMeta(description: string | null): {
  checklistPassed?: boolean;
  notes?: string;
} {
  if (!description) return {};
  const line = description.split("\n").find((item: string) => item.startsWith("INSPECTION_META:"));
  if (!line) return {};
  try {
    return JSON.parse(line.slice("INSPECTION_META:".length)) as {
      checklistPassed?: boolean;
      notes?: string;
    };
  } catch {
    return {};
  }
}

export function buildInspectionDescription(checklistPassed: boolean, notes?: string): string {
  const payload = JSON.stringify({ checklistPassed, notes: notes?.trim() ?? "" });
  return `INSPECTION_META:${payload}`;
}

export function randomImageSeed(rideId: string): string {
  const segment = randomUUID().slice(0, 8);
  return `https://picsum.photos/seed/${rideId}-${segment}/800/500`;
}
