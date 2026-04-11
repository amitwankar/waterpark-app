import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import { db } from "@/lib/db";

export const PARK_CONFIG_TAG = "park-config";
export const SINGLETON_ID = "1";

const SENSITIVE_FIELDS = [
  "razorpayKeyId",
  "razorpayKeySecret",
  "whatsappApiKey",
  "smsApiKey",
] as const;

type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

export interface OperatingDay {
  day: number;
  label: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

const DEFAULT_OPERATING_HOURS: OperatingDay[] = [
  { day: 0, label: "Mon", isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { day: 1, label: "Tue", isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { day: 2, label: "Wed", isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { day: 3, label: "Thu", isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { day: 4, label: "Fri", isOpen: true, openTime: "09:00", closeTime: "19:00" },
  { day: 5, label: "Sat", isOpen: true, openTime: "09:00", closeTime: "19:00" },
  { day: 6, label: "Sun", isOpen: true, openTime: "09:00", closeTime: "19:00" },
];

function parseOperatingHours(value: unknown): OperatingDay[] {
  if (!value || !Array.isArray(value)) {
    return DEFAULT_OPERATING_HOURS;
  }

  const normalized = value
    .map((item, index) => {
      const row = item as Record<string, unknown>;
      const day = Number(row.day ?? index);
      return {
        day,
        label: typeof row.label === "string" ? row.label : DEFAULT_OPERATING_HOURS[index]?.label ?? "Day",
        isOpen: Boolean(row.isOpen ?? true),
        openTime: typeof row.openTime === "string" ? row.openTime : "09:00",
        closeTime: typeof row.closeTime === "string" ? row.closeTime : "18:00",
      };
    })
    .sort((a, b) => a.day - b.day);

  return normalized.length === 7 ? normalized : DEFAULT_OPERATING_HOURS;
}

function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return "••••";

  const visibleTail = value.slice(-4);
  const prefixLength = Math.min(8, Math.max(0, value.length - 4));
  const prefix = value.slice(0, prefixLength);
  return `${prefix}••••${visibleTail}`;
}

export function isMaskedValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return value.includes("•") || value.includes("****");
}

function getMaskable(config: Record<string, unknown>, field: SensitiveField): string | null {
  const raw = config[field];
  return typeof raw === "string" ? raw : null;
}

export function maskConfig(config: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...config };
  for (const field of SENSITIVE_FIELDS) {
    masked[field] = maskSecret(getMaskable(config, field));
  }
  masked.operatingHours = parseOperatingHours(config.operatingHours ?? null);
  return masked;
}

async function ensureSingleton() {
  const existing = await db.parkConfig.findFirst();
  if (existing) {
    return existing;
  }

  return db.parkConfig.create({
    data: {
      id: SINGLETON_ID,
      parkName: "AquaWorld Park",
      timezone: "Asia/Kolkata",
      operatingHours: DEFAULT_OPERATING_HOURS as unknown as object,
    },
  });
}

const fetchCached = unstable_cache(
  async () => {
    const config = await ensureSingleton();
    return config;
  },
  ["park-config-singleton"],
  { tags: [PARK_CONFIG_TAG], revalidate: 300 },
);

export async function getCachedSettings() {
  return fetchCached();
}

export async function getSettings() {
  return ensureSingleton();
}

export function sanitizeSensitivePatch<T extends Record<string, unknown>>(patch: T): Partial<T> {
  const cleaned = { ...patch };
  for (const field of SENSITIVE_FIELDS) {
    const value = cleaned[field as keyof T];
    if (isMaskedValue(value)) {
      delete cleaned[field as keyof T];
    }
  }
  return cleaned;
}

export async function upsertSettings(data: Record<string, unknown>) {
  const existing = await db.parkConfig.findFirst({ select: { id: true } });
  if (existing) {
    return db.parkConfig.update({
      where: { id: existing.id },
      data,
    });
  }

  return db.parkConfig.create({
    data: {
      id: SINGLETON_ID,
      parkName: "AquaWorld Park",
      timezone: "Asia/Kolkata",
      operatingHours: DEFAULT_OPERATING_HOURS as unknown as object,
      ...data,
    },
  });
}

export function invalidateSettingsCache(): void {
  revalidateTag(PARK_CONFIG_TAG, "max");
}

export function getDefaultOperatingHours(): OperatingDay[] {
  return DEFAULT_OPERATING_HOURS;
}
