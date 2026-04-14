import "server-only";

import { db } from "@/lib/db";

function istDateParts(now = new Date()): { dateKey: string; isoDate: string } {
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const isoDate = dateFormatter.format(now); // YYYY-MM-DD
  return { isoDate, dateKey: isoDate.replaceAll("-", "") };
}

export function getIstTodayDateOnly(): Date {
  const { isoDate } = istDateParts();
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function normalizeQueuePrefix(value: unknown): string {
  const trimmed = String(value ?? "").trim().toUpperCase();
  const normalized = trimmed.replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return normalized.length > 0 ? normalized : "Q";
}

export type QueueCodeState = {
  queuePrefix: string;
  queueSeqDateKey: string;
  queueSeqNumber: number;
  queueSeqResetCount: number;
  queueLimitPerDay: number;
};

export function buildQueueCode(state: Pick<QueueCodeState, "queuePrefix" | "queueSeqResetCount">, dateKey: string, seq: number): string {
  const prefix = normalizeQueuePrefix(state.queuePrefix);
  const seqPart = String(Math.max(1, seq)).padStart(4, "0");
  if (state.queueSeqResetCount > 0) {
    return `${prefix}-${dateKey}-R${state.queueSeqResetCount}-${seqPart}`;
  }
  return `${prefix}-${dateKey}-${seqPart}`;
}

export async function allocateNextQueueCode(): Promise<{ queueCode: string; visitDate: Date }> {
  const today = getIstTodayDateOnly();
  const { dateKey } = istDateParts();

  return db.$transaction(async (tx) => {
    const config = await tx.parkConfig.upsert({
      where: { id: "1" },
      create: {
        id: "1",
        parkName: "AquaWorld Park",
        timezone: "Asia/Kolkata",
      },
      update: {},
      select: {
        queuePrefix: true,
        queueSeqDateKey: true,
        queueSeqNumber: true,
        queueSeqResetCount: true,
        queueLimitPerDay: true,
      },
    });

    const state: QueueCodeState = {
      queuePrefix: normalizeQueuePrefix(config.queuePrefix),
      queueSeqDateKey: String(config.queueSeqDateKey ?? ""),
      queueSeqNumber: Number(config.queueSeqNumber ?? 1),
      queueSeqResetCount: Number(config.queueSeqResetCount ?? 0),
      queueLimitPerDay: Number(config.queueLimitPerDay ?? 0),
    };

    if (state.queueLimitPerDay > 0) {
      const countToday = await tx.queueRequest.count({ where: { visitDate: today } });
      if (countToday >= state.queueLimitPerDay) {
        throw new Error("QUEUE_LIMIT_REACHED");
      }
    }

    const isNewDay = state.queueSeqDateKey !== dateKey;
    const seq = isNewDay ? 1 : Math.max(1, state.queueSeqNumber);
    const queueCode = buildQueueCode(state, dateKey, seq);

    await tx.parkConfig.update({
      where: { id: "1" },
      data: {
        queueSeqDateKey: dateKey,
        queueSeqNumber: seq + 1,
        ...(isNewDay ? { queueSeqResetCount: 0 } : {}),
      },
    });

    return { queueCode, visitDate: today };
  });
}

export async function resetQueueSequence(): Promise<void> {
  const { dateKey } = istDateParts();
  await db.parkConfig.upsert({
    where: { id: "1" },
    create: {
      id: "1",
      parkName: "AquaWorld Park",
      timezone: "Asia/Kolkata",
      queueSeqDateKey: dateKey,
      queueSeqNumber: 1,
      queueSeqResetCount: 1,
    },
    update: {
      queueSeqDateKey: dateKey,
      queueSeqNumber: 1,
      queueSeqResetCount: { increment: 1 },
    },
  });
}
