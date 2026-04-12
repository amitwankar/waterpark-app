export type BookingCustomDiscountType = "NONE" | "PERCENTAGE" | "AMOUNT";

export interface BookingPackageLineMeta {
  packageId: string;
  quantity: number;
}

export interface BookingFoodLineMeta {
  foodItemId: string;
  foodVariantId?: string;
  quantity: number;
}

export interface BookingLockerLineMeta {
  lockerId: string;
  quantity: number;
}

export interface BookingCostumeLineMeta {
  costumeItemId: string;
  quantity: number;
}

export interface BookingRideLineMeta {
  rideId: string;
  quantity: number;
}

export interface BookingPosPreloadMeta {
  packageLines: BookingPackageLineMeta[];
  foodLines: BookingFoodLineMeta[];
  lockerLines: BookingLockerLineMeta[];
  costumeLines: BookingCostumeLineMeta[];
  rideLines: BookingRideLineMeta[];
  customDiscountType: BookingCustomDiscountType;
  customDiscountValue: number;
  customDiscountAmount: number;
}

export interface BookingMetaV1 {
  version: 1;
  userNotes: string | null;
  posPreload: BookingPosPreloadMeta;
  issuedCoupon?: {
    id: string;
    code: string;
    validFrom: string;
    validTo: string;
  } | null;
}

const META_PREFIX = "__BOOKING_META_V1__:";

export function emptyPosPreloadMeta(): BookingPosPreloadMeta {
  return {
    packageLines: [],
    foodLines: [],
    lockerLines: [],
    costumeLines: [],
    rideLines: [],
    customDiscountType: "NONE",
    customDiscountValue: 0,
    customDiscountAmount: 0,
  };
}

export function emptyBookingMeta(userNotes: string | null = null): BookingMetaV1 {
  return {
    version: 1,
    userNotes,
    posPreload: emptyPosPreloadMeta(),
    issuedCoupon: null,
  };
}

function toBase64(input: string): string {
  return Buffer.from(input, "utf8").toString("base64");
}

function fromBase64(input: string): string {
  return Buffer.from(input, "base64").toString("utf8");
}

function parseMetaLine(line: string): BookingMetaV1 | null {
  if (!line.startsWith(META_PREFIX)) return null;
  const encoded = line.slice(META_PREFIX.length).trim();
  if (!encoded) return null;
  try {
    const decoded = fromBase64(encoded);
    const parsed = JSON.parse(decoded) as BookingMetaV1;
    if (parsed?.version !== 1 || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function splitBookingNotes(input: string | null | undefined): {
  userNotes: string | null;
  meta: BookingMetaV1 | null;
} {
  if (!input || !input.trim()) {
    return { userNotes: null, meta: null };
  }
  const lines = input.split("\n");
  let meta: BookingMetaV1 | null = null;
  const keptLines: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const candidate = parseMetaLine(line.trim());
    if (candidate) {
      meta = candidate;
      continue;
    }
    keptLines.push(rawLine);
  }
  const userNotes = keptLines.join("\n").trim();
  return {
    userNotes: userNotes.length > 0 ? userNotes : null,
    meta,
  };
}

export function buildBookingNotes(
  userNotes: string | null | undefined,
  posPreload?: Partial<BookingPosPreloadMeta> | null,
  existingMeta?: BookingMetaV1 | null,
): string | null {
  const notes = userNotes?.trim() ? userNotes.trim() : "";
  if (!posPreload && !existingMeta) {
    return notes || null;
  }
  const basePosPreload = posPreload ?? existingMeta?.posPreload ?? emptyPosPreloadMeta();
  const normalized: BookingPosPreloadMeta = {
    packageLines: basePosPreload.packageLines ?? emptyPosPreloadMeta().packageLines,
    foodLines: basePosPreload.foodLines ?? emptyPosPreloadMeta().foodLines,
    lockerLines: basePosPreload.lockerLines ?? emptyPosPreloadMeta().lockerLines,
    costumeLines: basePosPreload.costumeLines ?? emptyPosPreloadMeta().costumeLines,
    rideLines: basePosPreload.rideLines ?? emptyPosPreloadMeta().rideLines,
    customDiscountType: basePosPreload.customDiscountType ?? emptyPosPreloadMeta().customDiscountType,
    customDiscountValue: Number(basePosPreload.customDiscountValue ?? emptyPosPreloadMeta().customDiscountValue),
    customDiscountAmount: Number(basePosPreload.customDiscountAmount ?? emptyPosPreloadMeta().customDiscountAmount),
  };
  const meta: BookingMetaV1 = {
    version: 1,
    userNotes: notes || null,
    posPreload: normalized,
    issuedCoupon: existingMeta?.issuedCoupon ?? null,
  };
  const line = `${META_PREFIX}${toBase64(JSON.stringify(meta))}`;
  return notes ? `${notes}\n${line}` : line;
}
