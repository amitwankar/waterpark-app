import Link from "next/link";

import { FollowUpDueCard } from "@/components/crm/FollowUpDueCard";
import { GuestTable } from "@/components/crm/GuestTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { db } from "@/lib/db";

type GuestTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

interface GuestsPageProps {
  searchParams:
    | Promise<{ search?: string; tier?: GuestTier; tag?: string; sort?: string; order?: "asc" | "desc" }>
    | { search?: string; tier?: GuestTier; tag?: string; sort?: string; order?: "asc" | "desc" };
}

async function getGuestsCached(query: {
  search?: string;
  tier?: GuestTier;
  tag?: string;
  sort: string;
  order: "asc" | "desc";
}): Promise<{
  rows: Array<{
    id: string;
    name: string;
    mobile: string;
    tier: GuestTier;
    totalVisits: number;
    totalSpend: number;
    loyaltyPoints: number;
    lastVisitDate: string | null;
    tags: string[];
  }>;
  tags: string[];
  followUpDue: { count: number; overdue: number };
}> {
  "use cache";

  const where: any = {
    ...(query.tier ? { tier: query.tier } : {}),
    ...(query.tag ? { tags: { has: query.tag } } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { mobile: { contains: query.search } },
            { email: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orderBy: any =
    query.sort === "name"
      ? { name: query.order }
      : query.sort === "spend"
      ? { totalSpend: query.order }
      : query.sort === "points"
      ? { loyaltyPoints: query.order }
      : { lastVisitDate: query.order };

  const [rows, allTags, dueCount, overdueCount] = await Promise.all([
    db.guestProfile.findMany({ where, orderBy, take: 200 }),
    db.guestProfile.findMany({ select: { tags: true } }),
    db.lead.count({ where: { isDeleted: false, followUpAt: { lte: new Date() }, stage: { notIn: ["BOOKED", "LOST"] as any } } }),
    db.lead.count({ where: { isDeleted: false, followUpAt: { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, stage: { notIn: ["BOOKED", "LOST"] as any } } }),
  ]);

  const tags = (
    Array.from(
      new Set(allTags.flatMap((entry: any) => entry.tags.filter((tag: string) => !tag.startsWith("__note:")))),
    ) as string[]
  ).sort((a, b) => a.localeCompare(b));

  return {
    rows: rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      mobile: row.mobile,
      tier: row.tier as GuestTier,
      totalVisits: row.totalVisits,
      totalSpend: Number(row.totalSpend),
      loyaltyPoints: row.loyaltyPoints,
      lastVisitDate: row.lastVisitDate ? row.lastVisitDate.toISOString() : null,
      tags: row.tags.filter((tag: string) => !tag.startsWith("__note:")),
    })),
    tags,
    followUpDue: { count: dueCount, overdue: overdueCount },
  };
}

function buildTagHref(query: { search?: string; tier?: string; sort?: string; order?: string }, tag?: string): string {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.tier) params.set("tier", query.tier);
  if (query.sort) params.set("sort", query.sort);
  if (query.order) params.set("order", query.order);
  if (tag) params.set("tag", tag);
  const qs = params.toString();
  return qs ? `/admin/crm/guests?${qs}` : "/admin/crm/guests";
}

export default async function CrmGuestsPage({ searchParams }: GuestsPageProps): Promise<JSX.Element> {
  const params = await Promise.resolve(searchParams);
  const query = {
    search: params.search?.trim() || undefined,
    tier: params.tier,
    tag: params.tag,
    sort: params.sort ?? "lastVisit",
    order: params.order ?? "desc",
  };

  const data = await getGuestsCached(query);
  const csvParams = new URLSearchParams();
  if (query.search) csvParams.set("search", query.search);
  if (query.tier) csvParams.set("tier", query.tier);
  if (query.tag) csvParams.set("tags", query.tag);
  csvParams.set("sort", query.sort);
  csvParams.set("order", query.order);
  csvParams.set("export", "csv");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">CRM Guests</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Guest profiles, loyalty and booking intelligence</p>
        </div>
        <Link href={`/api/v1/crm/guests?${csvParams.toString()}`}>
          <Button variant="outline">Export CSV</Button>
        </Link>
      </div>

      <FollowUpDueCard count={data.followUpDue.count} overdueMoreThanOneDay={data.followUpDue.overdue} />

      <Card>
        <CardBody className="space-y-3">
          <form className="grid gap-3 lg:grid-cols-4" action="/admin/crm/guests" method="get">
            <Input name="search" defaultValue={query.search} placeholder="Search by name, mobile, email" />
            <select name="tier" defaultValue={query.tier ?? ""} className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm">
              <option value="">All tiers</option>
              {(["BRONZE", "SILVER", "GOLD", "PLATINUM"] as const).map((tier) => (
                <option key={tier} value={tier}>{tier}</option>
              ))}
            </select>
            <select name="sort" defaultValue={query.sort} className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm">
              <option value="lastVisit">Last Visit</option>
              <option value="spend">Total Spend</option>
              <option value="points">Points</option>
              <option value="name">Name</option>
            </select>
            <Button type="submit">Apply</Button>
          </form>

          <div className="flex flex-wrap gap-2">
            <Link href={buildTagHref(query)}>
              <Badge variant={!query.tag ? "info" : "default"}>All tags</Badge>
            </Link>
            {data.tags.map((tag: string) => (
              <Link key={tag} href={buildTagHref(query, tag)}>
                <Badge variant={query.tag === tag ? "info" : "default"}>{tag}</Badge>
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>

      <GuestTable rows={data.rows} />
    </div>
  );
}
