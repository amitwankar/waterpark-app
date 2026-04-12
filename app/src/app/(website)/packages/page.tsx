import { connection } from "next/server";

import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

interface PackageCard {
  id: string;
  name: string;
  description: string | null;
  listedPrice: number;
  salePrice: number;
  gstRate: number;
  items: Array<{ itemType: string; quantity: number; label: string }>;
}

async function getPackages(): Promise<PackageCard[]> {
  const packages = await db.salesPackage.findMany({
    where: { isActive: true, isDeleted: false },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          ticketType: { select: { name: true } },
          ride: { select: { name: true } },
          locker: { select: { number: true } },
          costumeItem: { select: { name: true } },
          foodItem: { select: { name: true } },
          foodVariant: { select: { name: true } },
        },
      },
    },
  });

  return packages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    listedPrice: Number(pkg.listedPrice),
    salePrice: Number(pkg.salePrice),
    gstRate: Number(pkg.gstRate),
    items: pkg.items.map((item) => ({
      itemType: item.itemType,
      quantity: item.quantity,
      label:
        item.ticketType?.name ??
        item.ride?.name ??
        item.locker?.number ??
        item.costumeItem?.name ??
        (item.foodVariant ? `${item.foodItem?.name ?? "Food"} - ${item.foodVariant.name}` : item.foodItem?.name) ??
        item.itemType,
    })),
  }));
}

export default async function PackagesPage(): Promise<JSX.Element> {
  await connection();
  const packages = await getPackages();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)]">Packages</h1>
        <p className="text-[var(--color-text-muted)]">Bundle tickets, rides, lockers, costumes, and food into one counter-ready offer.</p>
      </div>

      {packages.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-[var(--color-text-muted)]">
          No active packages are available right now.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {packages.map((pkg) => (
            <article key={pkg.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">{pkg.name}</h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">{pkg.description ?? "Bundled offer for a complete park visit."}</p>
              <div className="mt-5 flex items-end gap-2">
                <p className="text-2xl font-bold text-[var(--color-primary)]">{formatCurrency(pkg.salePrice)}</p>
                {pkg.listedPrice > pkg.salePrice ? (
                  <p className="pb-1 text-sm text-[var(--color-text-muted)] line-through">{formatCurrency(pkg.listedPrice)}</p>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">+{pkg.gstRate}% GST</p>
              <div className="mt-4 space-y-1 border-t border-[var(--color-border)] pt-3 text-sm text-[var(--color-text-muted)]">
                {pkg.items.map((item, index) => (
                  <p key={`${item.itemType}-${index}`}>
                    {item.label} x {item.quantity}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
