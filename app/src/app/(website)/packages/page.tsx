import Link from "next/link";

import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

const tabs = ["ALL", "ADULT", "CHILD", "FAMILY", "SENIOR"] as const;
type PackageTab = (typeof tabs)[number];

interface PackagesPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

interface TicketTypeItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  minAge: number | null;
  maxAge: number | null;
}

async function getPackageTickets(): Promise<TicketTypeItem[]> {
  "use cache";

  const itemsRaw = await db.ticketType.findMany({
    where: { isActive: true, isDeleted: false },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      minAge: true,
      maxAge: true,
    },
  });

  return itemsRaw.map((item) => ({
    ...item,
    price: Number(item.price),
  }));
}

function classifyTicket(item: TicketTypeItem): PackageTab {
  const name = item.name.toLowerCase();
  if (name.includes("family") || name.includes("pack")) return "FAMILY";
  if (name.includes("senior")) return "SENIOR";
  if (item.maxAge !== null && item.maxAge <= 12) return "CHILD";
  if (item.minAge !== null && item.minAge >= 12) return "ADULT";
  if (name.includes("child") || name.includes("kid")) return "CHILD";
  return "ADULT";
}

function readTab(rawTab: string | string[] | undefined): PackageTab {
  const raw = rawTab;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const normalized = String(value ?? "ALL").toUpperCase();
  if (tabs.includes(normalized as PackageTab)) {
    return normalized as PackageTab;
  }
  return "ALL";
}

export default async function PackagesPage({ searchParams }: PackagesPageProps): Promise<JSX.Element> {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const active = readTab(resolvedSearchParams?.tab);
  const items = await getPackageTickets();
  const filtered = items.filter((item) => active === "ALL" || classifyTicket(item) === active);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)]">Packages</h1>
        <p className="text-[var(--color-text-muted)]">Choose passes based on age groups, family bundles and seasonal offers.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab}
            href={tab === "ALL" ? "/packages" : `/packages?tab=${tab}`}
            className={`rounded-[var(--radius-full)] px-4 py-2 text-sm font-medium ${
              active === tab ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface-muted)] text-[var(--color-text)]"
            }`}
          >
            {tab}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((ticket) => (
          <article key={ticket.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{ticket.name}</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{ticket.description ?? "Great value ticket for a full day of fun."}</p>
            <p className="mt-5 text-2xl font-bold text-[var(--color-primary)]">{formatCurrency(ticket.price)}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Age: {ticket.minAge ?? 0}+ {ticket.maxAge !== null ? `to ${ticket.maxAge}` : ""}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
