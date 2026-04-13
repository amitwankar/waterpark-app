/**
 * POS shared utilities — server-only helpers.
 * Cart computation, coupon application, booking number generation.
 */
import "server-only";

import { evaluateCoupon } from "@/lib/coupon";
import { type CouponScopeMatrix } from "@/lib/coupon-scope";
import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartLineItem {
  ticketTypeId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
}

export interface CartTotals {
  subtotal: number;
  gstAmount: number;
  discountAmount: number;
  totalAmount: number;
}

export interface SplitPaymentLine {
  method: "CASH" | "MANUAL_UPI" | "CARD" | "COMPLIMENTARY";
  amount: number;
}

// ─── Coupon validation ────────────────────────────────────────────────────────

export async function validateCoupon(
  code: string,
  subtotal: number,
  ticketTypeIds: string[],
  context?: {
    mobile?: string;
    adults?: number;
    children?: number;
    adultPrice?: number;
    childPrice?: number;
    visitDate?: Date;
    scopeUsage?: Partial<CouponScopeMatrix>;
  },
): Promise<
  | { valid: true; coupon: { id: string; code: string; discountAmount: number; description: string | null } }
  | { valid: false; reason: string }
> {
  const result = await evaluateCoupon({
    code,
    subtotal,
    totalGuests: (context?.adults ?? 0) + (context?.children ?? 0),
    adults: context?.adults ?? 0,
    children: context?.children ?? 0,
    adultPrice: context?.adultPrice ?? subtotal,
    childPrice: context?.childPrice ?? 0,
    ticketTypeIds,
    visitDate: context?.visitDate ?? new Date(),
    mobile: context?.mobile ?? "9000000000",
    scopeUsage: context?.scopeUsage,
  });

  if (!result.valid || !result.couponId || !result.couponCode) {
    return { valid: false, reason: result.message ?? "Coupon not applicable" };
  }

  return {
    valid: true,
    coupon: {
      id: result.couponId,
      code: result.couponCode,
      discountAmount: result.discountAmount,
      description: null,
    },
  };
}

// ─── Cart computation ─────────────────────────────────────────────────────────

export function computeCartTotals(
  lines: CartLineItem[],
  discountAmount = 0
): CartTotals {
  let subtotal = 0;
  let gstAmount = 0;

  for (const line of lines) {
    const lineTotal = line.unitPrice * line.quantity;
    const lineGst = lineTotal * (line.gstRate / 100);
    subtotal += lineTotal;
    gstAmount += lineGst;
  }

  const totalAmount = Math.max(0, subtotal + gstAmount - discountAmount);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    gstAmount: Math.round(gstAmount * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

/** Validate that split payment lines cover the total exactly (within ₹0.01 rounding). */
export function validateSplitPayment(
  lines: SplitPaymentLine[],
  totalAmount: number
): { valid: boolean; reason?: string } {
  if (lines.length === 0) return { valid: false, reason: "No payment methods provided" };
  const paid = lines.reduce((s, l) => s + l.amount, 0);
  const diff = Math.abs(paid - totalAmount);
  if (diff > 0.01) {
    return {
      valid: false,
      reason: `Payment total ₹${paid.toFixed(2)} doesn't match order ₹${totalAmount.toFixed(2)}`,
    };
  }
  return { valid: true };
}

// ─── Booking number generation ────────────────────────────────────────────────

function getIstDateCode(): string {
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dateFormatter.format(new Date()).replaceAll("-", "");
}

function randomCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

export async function generateBookingNumber(): Promise<string> {
  const dateCode = getIstDateCode();

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = `AWP-${dateCode}-${randomCode()}`;
    const exists = await db.booking.findFirst({
      where: { bookingNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }

  return `AWP-${dateCode}-${Date.now().toString().slice(-4)}`;
}

// ─── Active session lookup ────────────────────────────────────────────────────

export async function getActiveSession(terminalId: string) {
  return db.posSession.findFirst({
    where: { terminalId, status: "OPEN" },
    include: {
      staff: { select: { id: true, name: true } },
      _count: { select: { transactions: true } },
    },
    orderBy: { openedAt: "desc" },
  });
}

// ─── Cash totals for session ──────────────────────────────────────────────────

export async function computeExpectedCash(sessionId: string, openingCash: number): Promise<number> {
  const [txResult, parkingResult] = await Promise.all([
    db.transaction.aggregate({
      where: {
        posSessionId: sessionId,
        method: "CASH",
        status: "PAID",
      },
      _sum: { amount: true },
    }),
    db.parkingTicket.aggregate({
      where: {
        posSessionId: sessionId,
        status: "EXITED",
        paymentMethod: "CASH",
      },
      _sum: { totalAmount: true },
    }),
  ]);

  const cashCollected = Number(txResult._sum.amount ?? 0);
  const parkingCash = Number(parkingResult._sum.totalAmount ?? 0);
  return Math.round((openingCash + cashCollected + parkingCash) * 100) / 100;
}
