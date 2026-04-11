import { incrementCapacity } from "@/lib/capacity";
import { db } from "@/lib/db";

export type PaymentType = "FULL" | "DEPOSIT" | "SPLIT" | "BALANCE";
export type SplitMethod = "GATEWAY" | "MANUAL_UPI" | "CASH" | "WRISTBAND";

export interface DepositConfig {
  enabled: boolean;
  percent: number;
  label: string;
}

export interface TransactionMeta {
  paymentType?: PaymentType;
  amount?: number;
  splitGroup?: string;
  splitPortion?: number;
  splitIndex?: number;
  isDeposit?: boolean;
  balanceDue?: number;
  balanceDueAfter?: number;
  bookingId?: string;
  bookingNumber?: string;
  utrHash?: string;
}

export interface BookingPaymentMeta {
  totalAmount: number;
  totalPaid: number;
  balanceDue: number;
  paymentType: PaymentType;
  updatedAt: string;
}

const BOOKING_META_PREFIX = "PAYMENT_META:";
const TX_META_PREFIX = "TX_META:";
const LOYALTY_DONE_MARK = "LOYALTY_DONE:true";
export const PARTIALLY_PAID_STATUS = "PARTIALLY_PAID";

function nowIso(): string {
  return new Date().toISOString();
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateDepositAmount(totalAmount: number, depositPercent: number): number {
  return Math.ceil(totalAmount * (depositPercent / 100));
}

export function calculateBalanceDue(totalAmount: number, paidAmount: number): number {
  return Math.max(0, roundCurrency(totalAmount - paidAmount));
}

export function isPartiallyPaidStatus(status: string): boolean {
  return status === PARTIALLY_PAID_STATUS;
}

export function resolveDepositConfig(rawParkConfig: any): DepositConfig {
  const enabled =
    typeof rawParkConfig?.depositEnabled === "boolean"
      ? rawParkConfig.depositEnabled
      : true;

  const percentRaw =
    typeof rawParkConfig?.depositPercent === "number"
      ? rawParkConfig.depositPercent
      : Number(rawParkConfig?.depositPercent ?? 30);
  const percent = Number.isFinite(percentRaw)
    ? Math.max(10, Math.min(90, Math.round(percentRaw)))
    : 30;

  const label =
    typeof rawParkConfig?.depositLabel === "string" && rawParkConfig.depositLabel.trim().length > 0
      ? rawParkConfig.depositLabel.trim()
      : "Book Now, Pay Rest at Gate";

  return { enabled, percent, label };
}

function readPrefixedJson<T>(notes: string | null | undefined, prefix: string): T | null {
  if (!notes) return null;
  const line = notes
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));
  if (!line) return null;

  try {
    return JSON.parse(line.slice(prefix.length)) as T;
  } catch {
    return null;
  }
}

function upsertPrefixedJson(notes: string | null | undefined, prefix: string, payload: unknown): string {
  const lines = (notes ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !item.startsWith(prefix));
  lines.push(`${prefix}${JSON.stringify(payload)}`);
  return lines.join("\n");
}

export function parseTransactionMeta(notes: string | null | undefined): TransactionMeta | null {
  return readPrefixedJson<TransactionMeta>(notes, TX_META_PREFIX);
}

export function mergeTransactionMeta(notes: string | null | undefined, meta: TransactionMeta): string {
  return upsertPrefixedJson(notes, TX_META_PREFIX, meta);
}

export function parseBookingPaymentMeta(notes: string | null | undefined): BookingPaymentMeta | null {
  return readPrefixedJson<BookingPaymentMeta>(notes, BOOKING_META_PREFIX);
}

export function mergeBookingPaymentMeta(notes: string | null | undefined, meta: BookingPaymentMeta): string {
  return upsertPrefixedJson(notes, BOOKING_META_PREFIX, meta);
}

export function paymentTypeFromTransactionNotes(notes: string | null | undefined): PaymentType {
  return parseTransactionMeta(notes)?.paymentType ?? "FULL";
}

export function getBalanceDueFromBooking(booking: { totalAmount: number | any; notes?: string | null }): number {
  const meta = parseBookingPaymentMeta(booking.notes);
  if (meta && typeof meta.balanceDue === "number") {
    return roundCurrency(meta.balanceDue);
  }

  return 0;
}

function resolveTier(points: number): "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" {
  if (points >= 5000) return "PLATINUM";
  if (points >= 2000) return "GOLD";
  if (points >= 500) return "SILVER";
  return "BRONZE";
}

async function applyLoyaltyIfNeeded(booking: {
  id: string;
  guestName: string;
  guestMobile: string;
  guestEmail: string | null;
  totalAmount: any;
  visitDate: Date;
  notes: string | null;
}): Promise<void> {
  if ((booking.notes ?? "").includes(LOYALTY_DONE_MARK)) {
    return;
  }

  const pointsPerRupee = await db.parkConfig
    .findFirst({
      select: { loyaltyPointsPerRupee: true },
    })
    .then((config: any) => Number(config?.loyaltyPointsPerRupee ?? 1));

  const spend = Number(booking.totalAmount);
  const earnedPoints = Math.max(0, Math.floor(spend * pointsPerRupee));

  const existingGuest = await db.guestProfile.findUnique({
    where: { mobile: booking.guestMobile },
    select: { id: true, loyaltyPoints: true },
  });

  if (existingGuest) {
    const nextPoints = existingGuest.loyaltyPoints + earnedPoints;
    await db.guestProfile.update({
      where: { id: existingGuest.id },
      data: {
        name: booking.guestName,
        email: booking.guestEmail ?? undefined,
        totalVisits: { increment: 1 },
        totalSpend: { increment: spend },
        loyaltyPoints: { increment: earnedPoints },
        tier: resolveTier(nextPoints),
        lastVisitDate: booking.visitDate,
      },
    });
  } else {
    await db.guestProfile.create({
      data: {
        mobile: booking.guestMobile,
        name: booking.guestName,
        email: booking.guestEmail ?? undefined,
        totalVisits: 1,
        totalSpend: spend,
        loyaltyPoints: earnedPoints,
        tier: resolveTier(earnedPoints),
        lastVisitDate: booking.visitDate,
      },
    });
  }

  const nextNotes = [booking.notes ?? "", LOYALTY_DONE_MARK].filter(Boolean).join("\n");
  await db.booking.update({
    where: { id: booking.id },
    data: { notes: nextNotes },
  });
}

export async function reconcileBookingPaymentState(args: {
  bookingId: string;
  incrementCapacityWhenConfirmed?: boolean;
}): Promise<{ totalPaid: number; totalAmount: number; balanceDue: number; status: string }> {
  const booking = await db.booking.findUnique({
    where: { id: args.bookingId },
    select: {
      id: true,
      status: true,
      notes: true,
      totalAmount: true,
      visitDate: true,
      adults: true,
      children: true,
      couponId: true,
      guestName: true,
      guestMobile: true,
      guestEmail: true,
      bookingNumber: true,
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }
  if (booking.status === "CANCELLED") {
    return {
      totalPaid: 0,
      totalAmount: Number(booking.totalAmount),
      balanceDue: Number(booking.totalAmount),
      status: booking.status,
    };
  }

  const paidAggregate = await db.transaction.aggregate({
    where: {
      bookingId: booking.id,
      status: "PAID",
    },
    _sum: { amount: true },
  });

  const totalPaid = roundCurrency(Number(paidAggregate._sum.amount ?? 0));
  const totalAmount = roundCurrency(Number(booking.totalAmount));
  const balanceDue = calculateBalanceDue(totalAmount, totalPaid);

  let nextStatus = "PENDING";
  if (totalPaid <= 0) {
    nextStatus = "PENDING";
  } else if (totalPaid < totalAmount) {
    nextStatus = PARTIALLY_PAID_STATUS;
  } else {
    nextStatus = "CONFIRMED";
  }

  const previousStatus = String(booking.status);
  const meta: BookingPaymentMeta = {
    totalAmount,
    totalPaid,
    balanceDue,
    paymentType: totalPaid < totalAmount ? "SPLIT" : "FULL",
    updatedAt: nowIso(),
  };

  await db.booking.update({
    where: { id: booking.id },
    data: {
      status: nextStatus as any,
      notes: mergeBookingPaymentMeta(booking.notes, meta),
    },
  });

  if (nextStatus === "CONFIRMED" && previousStatus !== "CONFIRMED" && previousStatus !== "CHECKED_IN" && previousStatus !== "COMPLETED") {
    if (booking.couponId) {
      await db.coupon.update({
        where: { id: booking.couponId },
        data: { usedCount: { increment: 1 } },
      });
    }

    await applyLoyaltyIfNeeded({
      id: booking.id,
      guestName: booking.guestName,
      guestMobile: booking.guestMobile,
      guestEmail: booking.guestEmail,
      totalAmount: booking.totalAmount,
      visitDate: booking.visitDate,
      notes: booking.notes,
    });

    if (args.incrementCapacityWhenConfirmed) {
      await incrementCapacity(booking.visitDate, booking.adults + booking.children);
    }
  }

  return {
    totalPaid,
    totalAmount,
    balanceDue,
    status: nextStatus,
  };
}

export async function getBookingPaymentSummary(bookingId: string): Promise<{
  totalAmount: number;
  totalPaid: number;
  balanceDue: number;
}> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { totalAmount: true },
  });
  if (!booking) {
    throw new Error("Booking not found");
  }

  const paidAggregate = await db.transaction.aggregate({
    where: {
      bookingId,
      status: "PAID",
    },
    _sum: { amount: true },
  });

  const totalAmount = roundCurrency(Number(booking.totalAmount));
  const totalPaid = roundCurrency(Number(paidAggregate._sum.amount ?? 0));
  const balanceDue = calculateBalanceDue(totalAmount, totalPaid);

  return { totalAmount, totalPaid, balanceDue };
}

export async function applyDepositToBooking(args: {
  bookingId: string;
  depositAmount: number;
  totalAmount: number;
  depositPercent: number;
  label: string;
}): Promise<{ bookingNumber: string; balanceDue: number }> {
  const booking = await db.booking.findUnique({
    where: { id: args.bookingId },
    select: {
      id: true,
      bookingNumber: true,
      notes: true,
    },
  });
  if (!booking) {
    throw new Error("Booking not found");
  }

  const balanceDue = calculateBalanceDue(args.totalAmount, args.depositAmount);
  await db.booking.update({
    where: { id: booking.id },
    data: {
      status: PARTIALLY_PAID_STATUS as any,
      notes: mergeBookingPaymentMeta(booking.notes, {
        totalAmount: roundCurrency(args.totalAmount),
        totalPaid: roundCurrency(args.depositAmount),
        balanceDue,
        paymentType: "DEPOSIT",
        updatedAt: nowIso(),
      }),
    },
  });

  return {
    bookingNumber: booking.bookingNumber,
    balanceDue,
  };
}

export async function applyFullPaymentToBooking(args: {
  bookingId: string;
  incrementCapacityCounter: boolean;
}): Promise<{ bookingNumber: string }> {
  const booking = await db.booking.findUnique({
    where: { id: args.bookingId },
    select: { id: true, bookingNumber: true },
  });
  if (!booking) {
    throw new Error("Booking not found");
  }

  await reconcileBookingPaymentState({
    bookingId: booking.id,
    incrementCapacityWhenConfirmed: args.incrementCapacityCounter,
  });

  return { bookingNumber: booking.bookingNumber };
}
