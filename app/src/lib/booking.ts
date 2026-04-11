import { z } from "zod";

const MOBILE_REGEX = /^[6-9]\d{9}$/;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const ticketLineSchema = z.object({
  ticketTypeId: z.string().trim().min(1, "Invalid ticket type"),
  quantity: z.number().int().min(1).max(50),
});

export type TicketLine = z.infer<typeof ticketLineSchema>;

export const bookingSchema = z
  .object({
    guestName: z.string().trim().min(2, "Guest name must be at least 2 characters").max(100, "Guest name is too long"),
    guestMobile: z.preprocess(
      (value) => (typeof value === "string" ? value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "") : value),
      z.string().regex(MOBILE_REGEX, "Enter a valid Indian mobile number"),
    ),
    guestEmail: z.preprocess(
      (value) => (typeof value === "string" ? value.trim() : value),
      z.union([z.literal(""), z.string().email("Enter a valid email").max(255)]).optional(),
    ),
    visitDate: z.string().trim().regex(DATE_ONLY_REGEX, "Visit date must be in YYYY-MM-DD format"),
    ticketLines: z
      .array(ticketLineSchema)
      .min(1, "Select at least one ticket type")
      .max(20, "Too many ticket types"),
    couponCode: z.string().trim().toUpperCase().max(40).optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    const today = getUtcDateStart(new Date());
    const maxDate = new Date(today);
    maxDate.setUTCDate(maxDate.getUTCDate() + 90);

    const parsedVisitDate = parseDateOnlyToUtc(value.visitDate);
    if (!parsedVisitDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid visit date",
        path: ["visitDate"],
      });
      return;
    }

    if (parsedVisitDate < today || parsedVisitDate > maxDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Visit date must be between today and next 90 days",
        path: ["visitDate"],
      });
    }

    const totalQty = value.ticketLines.reduce((s, l) => s + l.quantity, 0);
    if (totalQty < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Total ticket quantity must be at least 1",
        path: ["ticketLines"],
      });
    }

    if (totalQty > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Total ticket quantity cannot exceed 100",
        path: ["ticketLines"],
      });
    }
  });

export type BookingInput = z.infer<typeof bookingSchema>;

export interface TicketPriceLine {
  quantity: number;
  unitPrice: number;
}

export interface PricingInput {
  lines: TicketPriceLine[];
  gstRate: number;
  discountAmount: number;
}

export interface PricingBreakdown {
  subtotal: number;
  gstAmount: number;
  discountAmount: number;
  totalAmount: number;
}

export interface CouponLike {
  id: string;
  code: string;
  isActive: boolean;
  validFrom: Date;
  validTo: Date;
  usedCount: number;
  maxUses: number | null;
  minOrderAmount: number | null;
  discountType: "PERCENTAGE" | "FLAT";
  discountValue: number;
  maxDiscountCap: number | null;
}

export interface CouponValidationResult {
  ok: boolean;
  discountAmount: number;
  message?: string;
}

export function sanitizeGuestName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 100);
}

export function sanitizeMobile(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function sanitizeOptionalEmail(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const next = value.trim().toLowerCase();
  return next.length > 0 ? next.slice(0, 255) : null;
}

export function sanitizeCouponCode(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const next = value.trim().toUpperCase();
  return next.length > 0 ? next.slice(0, 40) : null;
}

export function parseDateOnlyToUtc(value: string): Date | null {
  if (!DATE_ONLY_REGEX.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function toDateOnlyString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function getUtcDateStart(value: Date): Date {
  const next = new Date(value);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePricing(input: PricingInput): PricingBreakdown {
  const subtotal = roundMoney(input.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
  const gstAmount = roundMoney(subtotal * (input.gstRate / 100));
  const safeDiscount = Math.max(0, roundMoney(input.discountAmount));
  const totalAmount = roundMoney(Math.max(0, subtotal + gstAmount - safeDiscount));

  return {
    subtotal,
    gstAmount,
    discountAmount: safeDiscount,
    totalAmount,
  };
}

export function validateCoupon(coupon: CouponLike, subtotal: number, now: Date = new Date()): CouponValidationResult {
  const normalizedSubtotal = roundMoney(subtotal);

  if (!coupon.isActive) {
    return { ok: false, discountAmount: 0, message: "Coupon is inactive" };
  }

  if (now < coupon.validFrom || now > coupon.validTo) {
    return { ok: false, discountAmount: 0, message: "Coupon is expired or not yet active" };
  }

  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, discountAmount: 0, message: "Coupon usage limit reached" };
  }

  if (coupon.minOrderAmount !== null && normalizedSubtotal < coupon.minOrderAmount) {
    return {
      ok: false,
      discountAmount: 0,
      message: `Minimum order amount for this coupon is Rs. ${coupon.minOrderAmount}`,
    };
  }

  if (coupon.discountType === "PERCENTAGE") {
    let discountAmount = roundMoney((normalizedSubtotal * coupon.discountValue) / 100);
    if (coupon.maxDiscountCap !== null) {
      discountAmount = Math.min(discountAmount, coupon.maxDiscountCap);
    }

    return {
      ok: true,
      discountAmount: roundMoney(Math.min(discountAmount, normalizedSubtotal)),
    };
  }

  return {
    ok: true,
    discountAmount: roundMoney(Math.min(coupon.discountValue, normalizedSubtotal)),
  };
}
