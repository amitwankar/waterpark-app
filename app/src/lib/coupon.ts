import { CouponAppliesTo, CouponDiscountType, CouponTarget, GuestTier, Prisma, WeekDay } from "@prisma/client";

import { isCouponScopeAllowed, resolveCouponScopeMatrix, type CouponScopeMatrix } from "@/lib/coupon-scope";
import { db } from "@/lib/db";

export interface CouponValidationContext {
  code: string;
  subtotal: number;
  totalGuests: number;
  adults: number;
  children: number;
  adultPrice: number;
  childPrice: number;
  ticketTypeIds: string[];
  visitDate: Date;
  mobile: string;
  userId?: string | null;
  isFoodBooking?: boolean;
  scopeUsage?: Partial<CouponScopeMatrix>;
}

export interface CouponEvaluationResult {
  valid: boolean;
  message?: string;
  couponId?: string;
  couponCode?: string;
  discountAmount: number;
  freeLocker: boolean;
}

const LEGACY_PERCENTAGE = new Set<CouponDiscountType>([
  CouponDiscountType.PERCENTAGE,
  CouponDiscountType.PERCENTAGE_DISCOUNT,
]);

const LEGACY_FLAT = new Set<CouponDiscountType>([
  CouponDiscountType.FLAT,
  CouponDiscountType.FLAT_DISCOUNT,
]);

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toWeekDay(date: Date): WeekDay {
  const idx = date.getUTCDay();
  const map: WeekDay[] = [
    WeekDay.SUNDAY,
    WeekDay.MONDAY,
    WeekDay.TUESDAY,
    WeekDay.WEDNESDAY,
    WeekDay.THURSDAY,
    WeekDay.FRIDAY,
    WeekDay.SATURDAY,
  ];
  return map[idx] ?? WeekDay.MONDAY;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function includesDate(dateList: Date[], visitDate: Date): boolean {
  const target = toDateOnly(visitDate);
  return dateList.some((date) => toDateOnly(date) === target);
}

function ticketScopeAllowed(
  appliesTo: CouponAppliesTo,
  ticketTypes: string[],
  couponTicketTypes: Array<{ ticketTypeId: string }>,
  adults: number,
  children: number,
): boolean {
  if (appliesTo === CouponAppliesTo.ALL_TICKETS) return true;
  if (appliesTo === CouponAppliesTo.ADULTS_ONLY) return adults > 0 && children === 0;
  if (appliesTo === CouponAppliesTo.CHILDREN_ONLY) return children > 0 && adults === 0;
  const allowed = new Set(couponTicketTypes.map((item) => item.ticketTypeId));
  return ticketTypes.some((item) => allowed.has(item));
}

function computeDiscountByType(
  discountType: CouponDiscountType,
  context: CouponValidationContext,
  coupon: {
    discountValue: Prisma.Decimal;
    maxDiscountCap: Prisma.Decimal | null;
    buyXQty: number | null;
    buyYQty: number | null;
    flatPerTicketAmount: Prisma.Decimal | null;
    foodDiscountValue: Prisma.Decimal | null;
    foodDiscountIsPercent: boolean;
  },
): number {
  const subtotal = roundMoney(context.subtotal);
  const discountValue = Number(coupon.discountValue ?? 0);
  const maxCap = coupon.maxDiscountCap ? Number(coupon.maxDiscountCap) : null;

  if (LEGACY_PERCENTAGE.has(discountType)) {
    let amount = roundMoney((subtotal * discountValue) / 100);
    if (maxCap !== null) amount = Math.min(amount, maxCap);
    return roundMoney(Math.min(amount, subtotal));
  }

  if (LEGACY_FLAT.has(discountType)) {
    return roundMoney(Math.min(discountValue, subtotal));
  }

  if (discountType === CouponDiscountType.FREE_TICKET) {
    const amount = context.children > 0 ? context.childPrice : context.adultPrice;
    return roundMoney(Math.min(amount, subtotal));
  }

  if (discountType === CouponDiscountType.BUY_X_GET_Y) {
    const buyX = Math.max(1, coupon.buyXQty ?? 1);
    const getY = Math.max(1, coupon.buyYQty ?? 1);
    const eligibleBlocks = Math.floor(context.adults / buyX);
    const freeChildren = Math.min(context.children, eligibleBlocks * getY);
    const amount = freeChildren * context.childPrice;
    return roundMoney(Math.min(amount, subtotal));
  }

  if (discountType === CouponDiscountType.FLAT_PER_TICKET) {
    const unitDiscount = Number(coupon.flatPerTicketAmount ?? coupon.discountValue ?? 0);
    const amount = unitDiscount * context.totalGuests;
    return roundMoney(Math.min(amount, subtotal));
  }

  if (discountType === CouponDiscountType.FOOD_DISCOUNT) {
    if (!context.isFoodBooking) return 0;
    const foodValue = Number(coupon.foodDiscountValue ?? coupon.discountValue ?? 0);
    if (coupon.foodDiscountIsPercent) {
      return roundMoney(Math.min((subtotal * foodValue) / 100, subtotal));
    }
    return roundMoney(Math.min(foodValue, subtotal));
  }

  // LOCKER_FREE gives perk only, no ticket discount.
  return 0;
}

export async function evaluateCoupon(context: CouponValidationContext): Promise<CouponEvaluationResult> {
  const code = context.code.trim().toUpperCase();
  if (!code) {
    return { valid: false, message: "Coupon code is required", discountAmount: 0, freeLocker: false };
  }

  const coupon = await db.coupon.findFirst({
    where: {
      code,
      isDeleted: false,
      isActive: true,
    },
    include: {
      couponTicketTypes: { select: { ticketTypeId: true } },
      freeTicketType: { select: { id: true, price: true } },
    },
  });

  if (!coupon) {
    return { valid: false, message: "Invalid coupon code", discountAmount: 0, freeLocker: false };
  }

  const now = new Date();
  const validUntil = coupon.validUntil ?? coupon.validTo;
  if (now < coupon.validFrom || now > validUntil) {
    return { valid: false, message: "Coupon is expired or not active yet", discountAmount: 0, freeLocker: false };
  }

  if (coupon.validDays.length > 0 && !coupon.validDays.includes(toWeekDay(context.visitDate))) {
    return { valid: false, message: "Coupon is not valid for selected weekday", discountAmount: 0, freeLocker: false };
  }

  if (coupon.validForDates.length > 0 && !includesDate(coupon.validForDates, context.visitDate)) {
    return { valid: false, message: "Coupon is not valid for selected date", discountAmount: 0, freeLocker: false };
  }

  const minAmount = Number(coupon.minBookingAmount ?? coupon.minOrderAmount ?? 0);
  if (minAmount > 0 && context.subtotal < minAmount) {
    return {
      valid: false,
      message: `Minimum booking amount is Rs.${minAmount}`,
      discountAmount: 0,
      freeLocker: false,
    };
  }

  if (coupon.minGuests && context.totalGuests < coupon.minGuests) {
    return { valid: false, message: `Minimum ${coupon.minGuests} guests required`, discountAmount: 0, freeLocker: false };
  }

  if (coupon.maxUses !== null && coupon.currentUses >= coupon.maxUses) {
    return { valid: false, message: "Coupon usage limit reached", discountAmount: 0, freeLocker: false };
  }

  const userUseCount = await db.couponRedemption.count({
    where: {
      couponId: coupon.id,
      mobile: context.mobile,
    },
  });
  if (coupon.maxUsesPerUser !== null && coupon.maxUsesPerUser !== undefined && userUseCount >= coupon.maxUsesPerUser) {
    return { valid: false, message: "Per-user coupon limit reached", discountAmount: 0, freeLocker: false };
  }

  const guestProfile = await db.guestProfile.findUnique({
    where: { mobile: context.mobile },
    select: { id: true, tier: true, totalVisits: true, dob: true, tags: true },
  });

  const previousBookingCount = await db.booking.count({
    where: {
      guestMobile: context.mobile,
      status: { not: "CANCELLED" },
    },
  });

  if (coupon.target === CouponTarget.MEMBER_ONLY && !guestProfile) {
    return { valid: false, message: "Coupon is valid only for members", discountAmount: 0, freeLocker: false };
  }

  if (coupon.target === CouponTarget.TIER_SPECIFIC) {
    if (!guestProfile) {
      return { valid: false, message: "Membership is required for this coupon", discountAmount: 0, freeLocker: false };
    }
    const allowedTiers = coupon.allowedTiers as GuestTier[];
    if (allowedTiers.length > 0 && !allowedTiers.includes(guestProfile.tier)) {
      return { valid: false, message: "Coupon is not valid for your loyalty tier", discountAmount: 0, freeLocker: false };
    }
  }

  if (coupon.target === CouponTarget.FIRST_VISIT && (guestProfile?.totalVisits ?? 0) > 0) {
    return { valid: false, message: "Coupon is valid for first visit only", discountAmount: 0, freeLocker: false };
  }

  if (coupon.target === CouponTarget.NEW_USER && previousBookingCount > 0) {
    return { valid: false, message: "Coupon is valid for new users only", discountAmount: 0, freeLocker: false };
  }

  if (coupon.target === CouponTarget.CORPORATE) {
    const hasCorporateTag = guestProfile?.tags.some((tag) => tag.toLowerCase() === "corporate") ?? false;
    if (!hasCorporateTag) {
      return { valid: false, message: "Corporate membership required", discountAmount: 0, freeLocker: false };
    }
  }

  if (coupon.target === CouponTarget.BIRTHDAY_MONTH) {
    const dob = guestProfile?.dob;
    if (!dob || dob.getUTCMonth() !== now.getUTCMonth()) {
      return { valid: false, message: "Coupon is valid in your birthday month only", discountAmount: 0, freeLocker: false };
    }
  }

  if (
    !ticketScopeAllowed(
      coupon.appliesTo,
      context.ticketTypeIds,
      coupon.couponTicketTypes,
      context.adults,
      context.children,
    )
  ) {
    return { valid: false, message: "Coupon does not apply to selected tickets", discountAmount: 0, freeLocker: false };
  }

  const scopeMatrix = resolveCouponScopeMatrix(coupon.applicableFor);
  if (!isCouponScopeAllowed(scopeMatrix, context.scopeUsage)) {
    return { valid: false, message: "Coupon does not apply to selected items", discountAmount: 0, freeLocker: false };
  }

  const discountAmount = computeDiscountByType(coupon.discountType, context, coupon);

  if (discountAmount <= 0 && coupon.discountType !== CouponDiscountType.LOCKER_FREE) {
    return { valid: false, message: "Coupon is not applicable for this cart", discountAmount: 0, freeLocker: false };
  }

  return {
    valid: true,
    couponId: coupon.id,
    couponCode: coupon.code,
    discountAmount,
    freeLocker: coupon.discountType === CouponDiscountType.LOCKER_FREE,
  };
}

export async function recordCouponRedemption(input: {
  couponId: string;
  bookingId: string;
  mobile: string;
  discountAmount: number;
  userId?: string | null;
}): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.coupon.update({
      where: { id: input.couponId },
      data: {
        currentUses: { increment: 1 },
        usedCount: { increment: 1 },
      },
    });

    await tx.couponRedemption.create({
      data: {
        couponId: input.couponId,
        bookingId: input.bookingId,
        userId: input.userId ?? null,
        mobile: input.mobile,
        discountAmount: roundMoney(input.discountAmount),
      },
    });
  });
}
