import { notFound } from "next/navigation";

import { GuestBookingsTab } from "@/components/crm/GuestBookingsTab";
import { GuestProfileCard } from "@/components/crm/GuestProfileCard";
import { LoyaltyLog } from "@/components/crm/LoyaltyLog";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { db } from "@/lib/db";

interface GuestDetailPageProps {
  params: Promise<{ id: string }> | { id: string };
  searchParams:
    | Promise<{ tab?: "bookings" | "loyalty" | "communications" | "analytics" }>
    | { tab?: "bookings" | "loyalty" | "communications" | "analytics" };
}

function extractNotes(tags: string[]): string {
  const noteTag = tags.find((tag: string) => tag.startsWith("__note:"));
  if (!noteTag) return "";
  try {
    return Buffer.from(noteTag.slice("__note:".length), "base64url").toString("utf8");
  } catch {
    return "";
  }
}

export default async function GuestDetailPage({ params, searchParams }: GuestDetailPageProps): Promise<JSX.Element> {
  const { id } = await Promise.resolve(params);
  const { tab = "bookings" } = await Promise.resolve(searchParams);

  const profile = await db.guestProfile.findUnique({
    where: { id },
    include: {
      loyaltyTransactions: {
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
  });

  if (!profile) notFound();

  const [bookings, communications] = await Promise.all([
    db.booking.findMany({
      where: { guestMobile: profile.mobile },
      include: { transactions: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.communicationLog.findMany({
      where: {
        OR: [
          { referenceType: "guest", referenceId: profile.id },
          { recipientMobile: profile.mobile },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { template: { select: { name: true } } },
    }),
  ]);

  const chartMap = new Map<string, { spend: number; visits: number }>();
  for (const booking of bookings) {
    if (booking.status === "CANCELLED") continue;
    const key = `${booking.createdAt.getFullYear()}-${String(booking.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const row = chartMap.get(key) ?? { spend: 0, visits: 0 };
    row.spend += Number(booking.totalAmount);
    row.visits += 1;
    chartMap.set(key, row);
  }

  const chartRows = Array.from(chartMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, value]) => ({ month, ...value }));

  return (
    <div className="grid gap-4 xl:grid-cols-[340px,1fr]">
      <GuestProfileCard
        guest={{
          id: profile.id,
          name: profile.name,
          mobile: profile.mobile,
          email: profile.email,
          tier: profile.tier as any,
          totalVisits: profile.totalVisits,
          totalSpend: Number(profile.totalSpend),
          loyaltyPoints: profile.loyaltyPoints,
          lastVisitDate: profile.lastVisitDate ? profile.lastVisitDate.toISOString() : null,
          tags: profile.tags.filter((tag: string) => !tag.startsWith("__note:")),
          notes: extractNotes(profile.tags),
        }}
      />

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <a href={`?tab=bookings`}><Badge variant={tab === "bookings" ? "info" : "default"}>Bookings</Badge></a>
          <a href={`?tab=loyalty`}><Badge variant={tab === "loyalty" ? "info" : "default"}>Loyalty Log</Badge></a>
          <a href={`?tab=communications`}><Badge variant={tab === "communications" ? "info" : "default"}>Communications</Badge></a>
          <a href={`?tab=analytics`}><Badge variant={tab === "analytics" ? "info" : "default"}>Analytics</Badge></a>
        </div>

        {tab === "bookings" ? (
          <GuestBookingsTab
            rows={bookings.map((booking: any) => ({
              id: booking.id,
              bookingNumber: booking.bookingNumber,
              visitDate: booking.visitDate.toISOString(),
              status: booking.status,
              totalAmount: Number(booking.totalAmount),
              paymentStatus:
                booking.transactions.some((tx: any) => tx.status === "PAID")
                  ? "PAID"
                  : booking.transactions.some((tx: any) => tx.status === "PENDING")
                  ? "PENDING"
                  : "FAILED",
            }))}
          />
        ) : null}

        {tab === "loyalty" ? (
          <LoyaltyLog
            items={profile.loyaltyTransactions.map((tx: any) => ({
              id: tx.id,
              type: tx.type,
              points: tx.points,
              description: tx.description,
              createdAt: tx.createdAt.toISOString(),
            }))}
          />
        ) : null}

        {tab === "communications" ? (
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--color-text)]">Communications</h3>
            </CardHeader>
            <CardBody className="space-y-2">
              {communications.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">No communications.</p> : null}
              {communications.map((item: any) => (
                <div key={item.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 text-sm">
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                    <span>{item.channel}</span>
                    <span>{new Date(item.createdAt).toLocaleString("en-IN")}</span>
                  </div>
                  <p className="mt-1 text-[var(--color-text)]">{item.template?.name ?? "Direct"}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.status}</p>
                </div>
              ))}
            </CardBody>
          </Card>
        ) : null}

        {tab === "analytics" ? (
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--color-text)]">Spend & Visit Analytics</h3>
            </CardHeader>
            <CardBody className="space-y-2">
              {chartRows.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">No analytics data yet.</p>
              ) : (
                chartRows.map((row) => (
                  <div
                    key={row.month}
                    className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 text-sm"
                  >
                    <span className="font-medium text-[var(--color-text)]">{row.month}</span>
                    <span className="text-[var(--color-text-muted)]">Visits: {row.visits}</span>
                    <span className="text-[var(--color-text-muted)]">Spend: Rs.{row.spend.toFixed(2)}</span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
