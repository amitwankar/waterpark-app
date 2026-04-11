import { db } from "@/lib/db";

export type GuestTierValue = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

function sanitizeReason(reason: string): string {
  return reason.trim().replace(/\s+/g, " ").slice(0, 500);
}

export function calculateTier(points: number): GuestTierValue {
  if (points >= 15000) return "PLATINUM";
  if (points >= 5000) return "GOLD";
  if (points >= 1000) return "SILVER";
  return "BRONZE";
}

export async function earnPoints(bookingId: string, amount: number): Promise<{ id: string; points: number }> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      guestMobile: true,
      guestName: true,
      guestEmail: true,
      status: true,
      visitDate: true,
    },
  });

  if (!booking) throw new Error("Booking not found");
  if (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED" && booking.status !== "CHECKED_IN") {
    throw new Error("Points can only be earned on confirmed bookings");
  }

  const points = Math.max(0, Math.floor(amount));

  const profile = await db.guestProfile.upsert({
    where: { mobile: booking.guestMobile },
    update: {
      name: booking.guestName,
      email: booking.guestEmail ?? undefined,
      totalVisits: { increment: 1 },
      totalSpend: { increment: amount },
      loyaltyPoints: { increment: points },
      lastVisitDate: booking.visitDate,
    },
    create: {
      mobile: booking.guestMobile,
      name: booking.guestName,
      email: booking.guestEmail ?? undefined,
      totalVisits: 1,
      totalSpend: amount,
      loyaltyPoints: points,
      lastVisitDate: booking.visitDate,
    },
    select: { id: true, loyaltyPoints: true },
  });

  await db.guestProfile.update({
    where: { id: profile.id },
    data: { tier: calculateTier(profile.loyaltyPoints) as any },
  });

  const transaction = await db.loyaltyTransaction.create({
    data: {
      guestProfileId: profile.id,
      points,
      type: "EARN" as any,
      description: `Points earned for booking ${booking.id}`,
      referenceId: booking.id,
      referenceType: "booking",
    },
    select: { id: true, points: true },
  });

  return transaction;
}

export async function redeemPoints(
  bookingId: string,
  pointsRequested: number,
): Promise<{ discountAmount: number; transactionId: string; pointsRedeemed: number }> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, guestMobile: true, totalAmount: true },
  });
  if (!booking) throw new Error("Booking not found");

  const guest = await db.guestProfile.findUnique({
    where: { mobile: booking.guestMobile },
    select: { id: true, loyaltyPoints: true },
  });
  if (!guest) throw new Error("Guest profile not found");

  const maxRedeemableAmount = Number(booking.totalAmount) * 0.2;
  const maxRedeemablePointsByBooking = Math.floor(maxRedeemableAmount / 0.5);
  const pointsRedeemed = Math.max(0, Math.min(pointsRequested, guest.loyaltyPoints, maxRedeemablePointsByBooking));
  if (pointsRedeemed <= 0) throw new Error("No redeemable points available");

  const discountAmount = Number((pointsRedeemed * 0.5).toFixed(2));

  const transaction = await db.$transaction(async (tx: any) => {
    await tx.guestProfile.update({
      where: { id: guest.id },
      data: { loyaltyPoints: { decrement: pointsRedeemed } },
    });

    const created = await tx.loyaltyTransaction.create({
      data: {
        guestProfileId: guest.id,
        points: -pointsRedeemed,
        type: "REDEEM",
        description: `Points redeemed on booking ${booking.id}`,
        referenceId: booking.id,
        referenceType: "booking",
      },
      select: { id: true },
    });

    const refreshed = await tx.guestProfile.findUnique({ where: { id: guest.id }, select: { loyaltyPoints: true } });
    if (refreshed) {
      await tx.guestProfile.update({ where: { id: guest.id }, data: { tier: calculateTier(refreshed.loyaltyPoints) } });
    }

    return created;
  });

  return { discountAmount, transactionId: transaction.id, pointsRedeemed };
}

export async function adjustPoints(
  guestId: string,
  points: number,
  type: "ADD" | "DEDUCT",
  reason: string,
): Promise<{ id: string; points: number }> {
  const absolutePoints = Math.max(0, Math.floor(points));
  if (absolutePoints === 0) throw new Error("Points must be greater than 0");

  const signed = type === "DEDUCT" ? -absolutePoints : absolutePoints;

  return db.$transaction(async (tx: any) => {
    const guest = await tx.guestProfile.findUnique({ where: { id: guestId }, select: { id: true, loyaltyPoints: true } });
    if (!guest) throw new Error("Guest profile not found");
    if (type === "DEDUCT" && guest.loyaltyPoints < absolutePoints) throw new Error("Insufficient points for deduction");

    const updated = await tx.guestProfile.update({
      where: { id: guest.id },
      data: { loyaltyPoints: { increment: signed } },
      select: { loyaltyPoints: true },
    });

    await tx.guestProfile.update({ where: { id: guest.id }, data: { tier: calculateTier(updated.loyaltyPoints) } });

    return tx.loyaltyTransaction.create({
      data: {
        guestProfileId: guest.id,
        points: signed,
        type: "ADJUST",
        description: sanitizeReason(reason),
        referenceType: "manual",
      },
      select: { id: true, points: true },
    });
  });
}

export async function expireOldPoints(): Promise<{ expiredGuests: number; expiredPoints: number }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365);

  const [earnRows, expireRows] = await Promise.all([
    db.loyaltyTransaction.findMany({ where: { type: "EARN" as any, createdAt: { lt: cutoff } }, select: { guestProfileId: true, points: true } }),
    db.loyaltyTransaction.findMany({ where: { type: "EXPIRE" as any, createdAt: { gte: cutoff } }, select: { guestProfileId: true, points: true } }),
  ]);

  const earnedByGuest = new Map<string, number>();
  for (const row of earnRows) earnedByGuest.set(row.guestProfileId, (earnedByGuest.get(row.guestProfileId) ?? 0) + row.points);
  for (const row of expireRows) earnedByGuest.set(row.guestProfileId, (earnedByGuest.get(row.guestProfileId) ?? 0) + row.points);

  let expiredGuests = 0;
  let expiredPoints = 0;

  for (const entry of Array.from(earnedByGuest.entries())) {
    const guestProfileId = entry[0];
    const netOldPoints = entry[1];
    if (netOldPoints <= 0) continue;

    await db.$transaction(async (tx: any) => {
      const guest = await tx.guestProfile.findUnique({ where: { id: guestProfileId }, select: { loyaltyPoints: true } });
      if (!guest || guest.loyaltyPoints <= 0) return;

      const pointsToExpire = Math.min(netOldPoints, guest.loyaltyPoints);
      if (pointsToExpire <= 0) return;

      const updated = await tx.guestProfile.update({
        where: { id: guestProfileId },
        data: { loyaltyPoints: { decrement: pointsToExpire } },
        select: { loyaltyPoints: true },
      });

      await tx.guestProfile.update({ where: { id: guestProfileId }, data: { tier: calculateTier(updated.loyaltyPoints) } });

      await tx.loyaltyTransaction.create({
        data: {
          guestProfileId,
          points: -pointsToExpire,
          type: "EXPIRE",
          description: "Auto-expired points older than 365 days",
          referenceId: `expiry-${new Date().toISOString().slice(0, 10)}`,
          referenceType: "expiry",
        },
      });

      expiredGuests += 1;
      expiredPoints += pointsToExpire;
    });
  }

  return { expiredGuests, expiredPoints };
}
