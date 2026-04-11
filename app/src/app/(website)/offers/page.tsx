import { connection } from "next/server";

import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

export default async function OffersPage(): Promise<JSX.Element> {
  await connection();
  const now = new Date();

  const coupons = await db.coupon.findMany({
    where: {
      isActive: true,
      isDeleted: false,
      isPublicOffer: true,
      validFrom: { lte: now },
      OR: [{ validUntil: null, validTo: { gte: now } }, { validUntil: { gte: now } }],
    },
    orderBy: [{ validUntil: "asc" }, { validTo: "asc" }],
    select: {
      id: true,
      code: true,
      title: true,
      description: true,
      discountType: true,
      discountValue: true,
      minBookingAmount: true,
      minOrderAmount: true,
      validUntil: true,
      validTo: true,
    },
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)]">Active Offers</h1>
        <p className="text-[var(--color-text-muted)]">Apply these codes during booking.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {coupons.map((coupon) => (
          <article
            key={coupon.id}
            className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-primary)] bg-[var(--color-primary-light)] p-5"
          >
            <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">{coupon.code}</p>
            {coupon.title ? <p className="mt-1 text-xs font-medium text-[var(--color-text)]">{coupon.title}</p> : null}
            <p className="mt-1 text-lg font-semibold text-[var(--color-text)]">
              {coupon.discountType === "PERCENTAGE" || coupon.discountType === "PERCENTAGE_DISCOUNT"
                ? `${Number(coupon.discountValue)}% OFF`
                : `${formatCurrency(Number(coupon.discountValue))} OFF`}
            </p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{coupon.description ?? "Limited period discount."}</p>
            {coupon.minBookingAmount || coupon.minOrderAmount ? (
              <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                Min booking: {formatCurrency(Number(coupon.minBookingAmount ?? coupon.minOrderAmount))}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Valid till {new Date(coupon.validUntil ?? coupon.validTo).toLocaleDateString("en-IN")}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
