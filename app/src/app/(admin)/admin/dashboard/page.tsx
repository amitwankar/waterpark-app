import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CarFront,
  CheckCircle2,
  CreditCard,
  Hammer,
  IndianRupee,
  Ticket,
  Users,
} from "lucide-react";

import { BookingStatusDonut } from "@/components/dashboard/BookingStatusDonut";
import { CrmQuickStats } from "@/components/dashboard/CrmQuickStats";
import { DateRangeFilter, type DatePreset } from "@/components/dashboard/DateRangeFilter";
import { FootfallChart } from "@/components/dashboard/FootfallChart";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { LiveCapacityBar } from "@/components/dashboard/LiveCapacityBar";
import { PaymentMethodChart } from "@/components/dashboard/PaymentMethodChart";
import { RecentBookingsTable } from "@/components/dashboard/RecentBookingsTable";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { RidesStatusGrid } from "@/components/dashboard/RidesStatusGrid";
import { StaffOnDutyTable } from "@/components/dashboard/StaffOnDutyTable";
import { UpiQueueStrip } from "@/components/dashboard/UpiQueueStrip";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

interface DashboardPageProps {
  searchParams:
    | Promise<{ preset?: DatePreset; start?: string; end?: string }>
    | { preset?: DatePreset; start?: string; end?: string };
}

interface Range {
  preset: DatePreset;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  startIso?: string;
  endIso?: string;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function parseRange(search: { preset?: DatePreset; start?: string; end?: string }): Range {
  const preset = search.preset ?? "today";
  const now = new Date();

  let start = startOfDay(now);
  let end = endOfDay(now);

  if (preset === "week") {
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day - 1));
    start = startOfDay(monday);
    end = endOfDay(now);
  }

  if (preset === "month") {
    start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    end = endOfDay(now);
  }

  if (preset === "custom" && search.start && search.end) {
    const customStart = new Date(search.start);
    const customEnd = new Date(search.end);
    if (!Number.isNaN(customStart.getTime()) && !Number.isNaN(customEnd.getTime())) {
      start = startOfDay(customStart);
      end = endOfDay(customEnd);
    }
  }

  const duration = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);

  return {
    preset,
    start,
    end,
    previousStart,
    previousEnd,
    startIso: search.start,
    endIso: search.end,
  };
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function trend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

async function getLiveGuests(): Promise<number> {
  const liveKey = "park:live:guests";
  const redisValue = await redis.get(liveKey);
  const parsed = Number(redisValue ?? "0");
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }

  const today = new Date().toISOString().slice(0, 10);
  const fallback = await redis.get(`park:capacity:${today}`);
  const fallbackParsed = Number(fallback ?? "0");
  return Number.isFinite(fallbackParsed) ? fallbackParsed : 0;
}

async function getCachedRevenueData(range: Range): Promise<Array<{ label: string; total: number; gateway: number; upiCash: number }>> {
  "use cache";

  const granularity = range.preset === "today" ? "hourly" : "daily";
  const rows = await db.transaction.findMany({
    where: {
      status: "PAID",
      createdAt: { gte: range.start, lte: range.end },
    },
    select: {
      amount: true,
      method: true,
      createdAt: true,
    },
  });

  const bucket = new Map<string, { total: number; gateway: number; upiCash: number }>();

  for (const row of rows) {
    const key =
      granularity === "hourly"
        ? `${String(row.createdAt.getHours()).padStart(2, "0")}:00`
        : row.createdAt.toISOString().slice(0, 10);

    const current = bucket.get(key) ?? { total: 0, gateway: 0, upiCash: 0 };
    const amount = Number(row.amount);
    current.total += amount;
    if (row.method === "GATEWAY") current.gateway += amount;
    if (row.method === "MANUAL_UPI" || row.method === "CASH") current.upiCash += amount;
    bucket.set(key, current);
  }

  return Array.from(bucket.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, item]) => ({
      label,
      total: Number(item.total.toFixed(2)),
      gateway: Number(item.gateway.toFixed(2)),
      upiCash: Number(item.upiCash.toFixed(2)),
    }));
}

async function getCachedFootfallData(range: Range): Promise<Array<{ label: string; adults: number; children: number; total: number }>> {
  "use cache";

  const granularity = range.preset === "today" ? "hourly" : "daily";

  const rows = await db.booking.findMany({
    where: {
      createdAt: { gte: range.start, lte: range.end },
      status: { not: "CANCELLED" },
    },
    select: {
      createdAt: true,
      adults: true,
      children: true,
    },
  });

  const bucket = new Map<string, { adults: number; children: number }>();

  for (const row of rows) {
    const key =
      granularity === "hourly"
        ? `${String(row.createdAt.getHours()).padStart(2, "0")}:00`
        : row.createdAt.toISOString().slice(0, 10);

    const current = bucket.get(key) ?? { adults: 0, children: 0 };
    current.adults += row.adults;
    current.children += row.children;
    bucket.set(key, current);
  }

  return Array.from(bucket.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, item]) => ({
      label,
      adults: item.adults,
      children: item.children,
      total: item.adults + item.children,
    }));
}

async function getCachedBookingStatusData(range: Range): Promise<Array<{ status: string; count: number }>> {
  "use cache";

  const statuses = ["CONFIRMED", "PENDING", "CHECKED_IN", "CANCELLED", "COMPLETED"];
  const counts = await Promise.all(
    statuses.map((status) =>
      db.booking.count({
        where: {
          status: status as any,
          createdAt: { gte: range.start, lte: range.end },
        },
      }),
    ),
  );

  return statuses.map((status, index) => ({ status, count: counts[index] }));
}

async function getCachedPaymentMethodData(range: Range): Promise<Array<{ method: string; count: number; amount: number }>> {
  "use cache";

  const methods = ["GATEWAY", "MANUAL_UPI", "CASH", "SPLIT"] as const;

  const [gatewayCount, gatewayAmount, upiCount, upiAmount, cashCount, cashAmount, splitRows] = await Promise.all([
    db.transaction.count({ where: { method: "GATEWAY", status: "PAID", createdAt: { gte: range.start, lte: range.end } } }),
    db.transaction.aggregate({
      _sum: { amount: true },
      where: { method: "GATEWAY", status: "PAID", createdAt: { gte: range.start, lte: range.end } },
    }),
    db.transaction.count({ where: { method: "MANUAL_UPI", status: "PAID", createdAt: { gte: range.start, lte: range.end } } }),
    db.transaction.aggregate({
      _sum: { amount: true },
      where: { method: "MANUAL_UPI", status: "PAID", createdAt: { gte: range.start, lte: range.end } },
    }),
    db.transaction.count({ where: { method: "CASH", status: "PAID", createdAt: { gte: range.start, lte: range.end } } }),
    db.transaction.aggregate({
      _sum: { amount: true },
      where: { method: "CASH", status: "PAID", createdAt: { gte: range.start, lte: range.end } },
    }),
    db.transaction.findMany({
      where: { createdAt: { gte: range.start, lte: range.end } },
      select: { notes: true, amount: true, status: true },
    }),
  ]);

  const splitGroups = new Map<string, number>();
  for (const row of splitRows) {
    const line = (row.notes ?? "").split("\n").find((item: string) => item.startsWith("TX_META:"));
    if (!line) continue;

    try {
      const meta = JSON.parse(line.slice("TX_META:".length)) as { splitGroup?: string };
      if (meta.splitGroup && row.status === "PAID") {
        splitGroups.set(meta.splitGroup, (splitGroups.get(meta.splitGroup) ?? 0) + Number(row.amount));
      }
    } catch {
      continue;
    }
  }

  return [
    { method: methods[0], count: gatewayCount, amount: Number(gatewayAmount._sum.amount ?? 0) },
    { method: methods[1], count: upiCount, amount: Number(upiAmount._sum.amount ?? 0) },
    { method: methods[2], count: cashCount, amount: Number(cashAmount._sum.amount ?? 0) },
    {
      method: methods[3],
      count: splitGroups.size,
      amount: Number(Array.from(splitGroups.values()).reduce((acc, value) => acc + value, 0).toFixed(2)),
    },
  ];
}

export default async function AdminDashboardPage({ searchParams }: DashboardPageProps): Promise<JSX.Element> {
  const params = await Promise.resolve(searchParams);
  const range = parseRange(params);

  const [
    bookingCount,
    previousBookingCount,
    revenueAggregate,
    previousRevenueAggregate,
    pendingUpiCount,
    activeRidesCount,
    maintenanceRidesCount,
    openWorkOrders,
    criticalWorkOrders,
    parkConfig,
    liveGuests,
    revenueBreakdownGateway,
    revenueBreakdownUpi,
    revenueBreakdownCash,
    recentBookings,
    upiQueueRows,
    totalLeads,
    convertedLeads,
    followUpsDue,
    totalGuests,
    tierBreakdown,
    guestsNewThisMonth,
    rides,
    staffShifts,
    revenueSeries,
    footfallSeries,
    bookingStatusSeries,
    paymentMethodSeries,
    parkingEntriesToday,
    parkingExitsToday,
    parkingRevenueToday,
  ] = await Promise.all([
    db.booking.count({ where: { createdAt: { gte: range.start, lte: range.end } } }),
    db.booking.count({ where: { createdAt: { gte: range.previousStart, lte: range.previousEnd } } }),
    db.transaction.aggregate({ _sum: { amount: true }, where: { status: "PAID", createdAt: { gte: range.start, lte: range.end } } }),
    db.transaction.aggregate({ _sum: { amount: true }, where: { status: "PAID", createdAt: { gte: range.previousStart, lte: range.previousEnd } } }),
    db.transaction.count({ where: { method: "MANUAL_UPI", status: "PENDING" } }),
    db.ride.count({ where: { isDeleted: false, status: "ACTIVE" } }),
    db.ride.count({ where: { isDeleted: false, status: "MAINTENANCE" } }),
    db.workOrder.count({ where: { isDeleted: false, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.workOrder.count({ where: { isDeleted: false, status: { in: ["OPEN", "IN_PROGRESS"] }, priority: "CRITICAL" } }),
    db.parkConfig.findFirst({ select: { maxCapacityPerDay: true } }),
    getLiveGuests(),
    db.transaction.aggregate({ _sum: { amount: true }, where: { status: "PAID", method: "GATEWAY", createdAt: { gte: range.start, lte: range.end } } }),
    db.transaction.aggregate({ _sum: { amount: true }, where: { status: "PAID", method: "MANUAL_UPI", createdAt: { gte: range.start, lte: range.end } } }),
    db.transaction.aggregate({ _sum: { amount: true }, where: { status: "PAID", method: "CASH", createdAt: { gte: range.start, lte: range.end } } }),
    db.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { transactions: { select: { method: true, amount: true } } },
    }),
    db.transaction.findMany({
      where: { method: "MANUAL_UPI", status: "PENDING" },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        booking: { select: { bookingNumber: true } },
      },
    }),
    db.lead.count({ where: { isDeleted: false } }),
    db.lead.count({ where: { isDeleted: false, stage: "BOOKED" } }),
    db.lead.count({ where: { isDeleted: false, followUpAt: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) } } }),
    db.guestProfile.count(),
    db.guestProfile.groupBy({ by: ["tier"], _count: { tier: true } }),
    db.guestProfile.count({ where: { createdAt: { gte: startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) } } }),
    db.ride.findMany({
      where: { isDeleted: false },
      include: { zone: { select: { name: true } } },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    db.shift.findMany({
      where: { shiftDate: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) } },
      include: { staff: { include: { user: { select: { name: true, subRole: true } } } } },
      orderBy: { startTime: "asc" },
      take: 5,
    }),
    getCachedRevenueData(range),
    getCachedFootfallData(range),
    getCachedBookingStatusData(range),
    getCachedPaymentMethodData(range),
    db.parkingTicket.count({
      where: {
        entryAt: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) },
      },
    }),
    db.parkingTicket.count({
      where: {
        status: "EXITED",
        exitAt: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) },
      },
    }),
    db.parkingTicket.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: "EXITED",
        exitAt: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) },
      },
    }),
  ]);

  const todayRevenue = Number(revenueAggregate._sum.amount ?? 0);
  const previousRevenue = Number(previousRevenueAggregate._sum.amount ?? 0);

  const ridesLive = await Promise.all(
    rides.map(async (ride: any) => {
      const queue = await redis.get(`ride:queue:${ride.id}`);
      const parsedQueue = Number(queue ?? "0");
      return {
        id: ride.id,
        name: ride.name,
        zone: ride.zone?.name ?? "Unassigned",
        status: ride.status,
        queueCount: Number.isFinite(parsedQueue) ? parsedQueue : 0,
      } as const;
    }),
  );

  async function updateRideStatus(rideId: string, status: "ACTIVE" | "MAINTENANCE" | "CLOSED" | "SEASONAL"): Promise<void> {
    "use server";

    await db.ride.update({
      where: { id: rideId },
      data: { status },
    });
  }

  const staffRows = staffShifts.map((row: any) => {
    const now = new Date();
    let status: "Present" | "Absent" | "Not Started" = "Absent";

    if (row.startTime > now) {
      status = "Not Started";
    } else if (row.isPresent) {
      status = "Present";
    }

    return {
      id: row.id,
      name: row.staff.user.name,
      role: row.staff.user.subRole ?? "EMPLOYEE",
      shift: row.shiftType,
      clockIn: row.startTime ? row.startTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : null,
      status,
    };
  });

  const convertedPercent = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

  const tierData = ["BRONZE", "SILVER", "GOLD", "PLATINUM"].map((tier) => ({
    tier,
    count: tierBreakdown.find((item: any) => item.tier === tier)?._count.tier ?? 0,
  }));

  const totalBookingsDonut = bookingStatusSeries.reduce((acc: number, item: any) => acc + item.count, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Admin Dashboard"
        subtitle="Operational and revenue intelligence"
        actions={[
          {
            key: "range",
            element: (
              <Badge variant="info">
                {range.preset.toUpperCase()}
              </Badge>
            ),
          },
        ]}
      />

      <DateRangeFilter preset={range.preset} start={range.startIso} end={range.endIso} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          title="Today Bookings"
          value={String(bookingCount)}
          trend={trend(bookingCount, previousBookingCount)}
          subLabel="vs yesterday"
          badge={<Ticket className="h-4 w-4 text-[var(--color-primary)]" />}
        />

        <KpiCard
          title="Today Revenue"
          value={formatInr(todayRevenue)}
          trend={trend(todayRevenue, previousRevenue)}
          subLabel={`G:${formatInr(Number(revenueBreakdownGateway._sum.amount ?? 0))} U:${formatInr(Number(revenueBreakdownUpi._sum.amount ?? 0))} C:${formatInr(Number(revenueBreakdownCash._sum.amount ?? 0))}`}
          badge={<IndianRupee className="h-4 w-4 text-[var(--color-primary)]" />}
        />

        <Card>
          <CardBody className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--color-text-muted)]">Guests in Park</p>
              <Users className="h-4 w-4 text-[var(--color-primary)]" />
            </div>
            <p className="text-2xl font-semibold text-[var(--color-text)]">{liveGuests}</p>
            <LiveCapacityBar initialGuests={liveGuests} capacity={parkConfig?.maxCapacityPerDay ?? 2000} />
          </CardBody>
        </Card>

        <KpiCard
          title="Pending UPI"
          value={String(pendingUpiCount)}
          subLabel="Awaiting verification"
          href="/admin/payments/upi-queue"
          alert={pendingUpiCount > 0 ? "warning" : "none"}
          badge={
            pendingUpiCount > 0 ? (
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
            )
          }
        />

        <KpiCard
          title="Active Rides"
          value={String(activeRidesCount)}
          subLabel={`${maintenanceRidesCount} in maintenance`}
          badge={<Activity className="h-4 w-4 text-[var(--color-primary)]" />}
        />

        <KpiCard
          title="Open Work Orders"
          value={String(openWorkOrders)}
          subLabel={`${criticalWorkOrders} critical`}
          alert={criticalWorkOrders > 0 ? "danger" : "none"}
          badge={criticalWorkOrders > 0 ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <Hammer className="h-4 w-4 text-[var(--color-primary)]" />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          title="Parking Entries Today"
          value={String(parkingEntriesToday)}
          subLabel="Vehicles checked in"
          badge={<CarFront className="h-4 w-4 text-[var(--color-primary)]" />}
        />
        <KpiCard
          title="Parking Exits Today"
          value={String(parkingExitsToday)}
          subLabel="Vehicles checked out"
          badge={<CarFront className="h-4 w-4 text-[var(--color-primary)]" />}
        />
        <KpiCard
          title="Parking Revenue Today"
          value={formatInr(Number(parkingRevenueToday._sum.totalAmount ?? 0))}
          subLabel="Collected at exit"
          badge={<IndianRupee className="h-4 w-4 text-[var(--color-primary)]" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RevenueChart data={revenueSeries} />
        <FootfallChart data={footfallSeries} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BookingStatusDonut data={bookingStatusSeries} />
        <PaymentMethodChart data={paymentMethodSeries} />
      </div>

      <RecentBookingsTable
        rows={recentBookings.map((booking: any) => ({
          id: booking.id,
          bookingNumber: booking.bookingNumber,
          guestName: booking.guestName,
          guestMobile: booking.guestMobile,
          visitDate: booking.visitDate.toISOString(),
          amount: Number(booking.totalAmount),
          status: booking.status,
          methods: booking.transactions.map((tx: any) => ({ method: tx.method, amount: Number(tx.amount) })),
        }))}
      />

      <UpiQueueStrip
        items={upiQueueRows.map((row: any) => ({
          id: row.id,
          bookingNumber: row.booking.bookingNumber,
          amount: Number(row.amount),
          minutesAgo: Math.max(1, Math.floor((Date.now() - row.createdAt.getTime()) / 60000)),
        }))}
      />

      <CrmQuickStats
        leads={{
          total: totalLeads,
          convertedPercent,
          followUpsDueToday: followUpsDue,
        }}
        guests={{
          total: totalGuests,
          newThisMonth: guestsNewThisMonth,
          tiers: tierData,
        }}
      />

      <RidesStatusGrid items={ridesLive} onStatusUpdate={updateRideStatus} />

      <StaffOnDutyTable rows={staffRows} />

      <div className="hidden">
        <CreditCard />
        <Users />
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">Total bookings in donut: {totalBookingsDonut}</p>

      <div className="flex justify-end">
        <Link href="/admin/bookings" className="text-sm text-[var(--color-primary)] underline">
          View all bookings
        </Link>
      </div>
    </div>
  );
}

