import Link from "next/link";
import { connection } from "next/server";
import { Star } from "lucide-react";

import { InquiryForm } from "@/components/website/InquiryForm";
import { db } from "@/lib/db";
import { getCachedSettings } from "@/lib/settings";
import { formatCurrency } from "@/lib/utils";

export default async function WebsiteHomePage(): Promise<JSX.Element> {
  await connection();
  const now = new Date();
  const settings = await getCachedSettings();

  const [rides, packages, coupons, bookingCount] = await Promise.all([
    db.ride.findMany({
      where: { isDeleted: false },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 6,
      include: { zone: { select: { name: true } } },
    }),
    db.salesPackage.findMany({
      where: { isActive: true, isDeleted: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 4,
      select: { id: true, name: true, description: true, salePrice: true },
    }),
    db.coupon.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        isPublicOffer: true,
        OR: [{ validUntil: null, validTo: { gte: now } }, { validUntil: { gte: now } }],
      },
      orderBy: [{ validUntil: "asc" }, { validTo: "asc" }],
      take: 3,
      select: { id: true, code: true, description: true, title: true, discountType: true, discountValue: true },
    }),
    db.booking.count({ where: { status: { in: ["CONFIRMED", "CHECKED_IN", "COMPLETED"] } } }),
  ]);

  return (
    <div>
      <section className="bg-gradient-to-br from-teal-800 via-teal-700 to-cyan-700 text-white">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div className="space-y-6">
            <span className="inline-flex rounded-[var(--radius-full)] bg-white/15 px-3 py-1 text-sm">Nagpur&apos;s Family Waterpark</span>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Thrill rides, wave pools and perfect day-outs at {settings.parkName}</h1>
            <p className="max-w-xl text-base text-white/85 sm:text-lg">
              Plan your family visit, school trip, corporate outing or celebration. Live ride updates, transparent pricing and quick booking.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/booking" className="rounded-[var(--radius-md)] bg-white px-5 py-3 text-sm font-semibold text-teal-800 transition-colors duration-150 hover:bg-teal-50">
                Book Tickets
              </Link>
              <Link href="/inquiry" className="rounded-[var(--radius-md)] border border-white/50 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/10">
                Group Inquiry
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div>
                <p className="text-2xl font-bold">{bookingCount.toLocaleString("en-IN")}+</p>
                <p className="text-xs text-white/80">Happy Bookings</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{settings.maxCapacityPerDay.toLocaleString("en-IN")}</p>
                <p className="text-xs text-white/80">Daily Capacity</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{rides.length}+</p>
                <p className="text-xs text-white/80">Attractions</p>
              </div>
            </div>
          </div>
          <div className="rounded-[var(--radius-xl)] border border-white/25 bg-white/10 p-4 shadow-[var(--shadow-modal)] backdrop-blur">
            <img
              src="https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=1400&q=80"
              alt="AquaWorld park overview"
              className="h-full min-h-80 w-full rounded-[var(--radius-lg)] object-cover"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-semibold text-[var(--color-text)]">Popular Rides</h2>
          <Link href="/rides" className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
            View All
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rides.map((ride) => (
            <article key={ride.id} className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
              <img
                src={ride.imageUrl ?? `https://picsum.photos/seed/ride-home-${ride.id}/900/600`}
                alt={ride.name}
                className="h-48 w-full object-cover"
              />
              <div className="space-y-2 p-4">
                <h3 className="font-semibold text-[var(--color-text)]">{ride.name}</h3>
                <p className="text-sm text-[var(--color-text-muted)]">{ride.zone.name}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[var(--color-surface-muted)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-2xl font-semibold text-[var(--color-text)]">Packages</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {packages.map((item) => (
              <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4">
                <h3 className="font-semibold text-[var(--color-text)]">{item.name}</h3>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{item.description || "Great value package for your visit."}</p>
                <p className="mt-4 text-xl font-bold text-[var(--color-primary)]">{formatCurrency(Number(item.salePrice))}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-2xl font-semibold text-[var(--color-text)]">Current Offers</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {coupons.map((coupon) => (
            <article key={coupon.id} className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-primary)] bg-[var(--color-primary-light)] p-4">
              <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">{coupon.code}</p>
              <p className="mt-1 text-sm text-[var(--color-text)]">
                {coupon.discountType === "PERCENTAGE" || coupon.discountType === "PERCENTAGE_DISCOUNT"
                  ? `${Number(coupon.discountValue)}% OFF`
                  : `${formatCurrency(Number(coupon.discountValue))} OFF`}
              </p>
              {coupon.title ? <p className="mt-1 text-xs font-medium text-[var(--color-text-muted)]">{coupon.title}</p> : null}
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{coupon.description ?? "Limited period offer."}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[var(--color-surface-muted)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-2xl font-semibold text-[var(--color-text)]">What Guests Say</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              "Kids zone was clean and safe. Staff was helpful.",
              "Corporate outing went smooth from booking to entry.",
              "Ride updates and online booking made the day hassle-free.",
            ].map((review) => (
              <article key={review} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4">
                <div className="mb-3 flex text-[var(--color-secondary)]">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star key={idx} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">{review}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)]">
          <iframe
            title="AquaWorld map"
            className="h-full min-h-96 w-full"
            loading="lazy"
            src="https://www.google.com/maps?q=Hingna+Road+Nagpur+Maharashtra&output=embed"
          />
        </div>
        <InquiryForm compact />
      </section>
    </div>
  );
}
