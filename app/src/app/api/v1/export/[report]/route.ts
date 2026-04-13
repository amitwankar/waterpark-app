import { NextRequest } from "next/server";

import { requireAdmin } from "@/lib/session";
import { buildDateRange } from "@/lib/reports";
import { exportToCSV, exportToExcel, exportToPDF, type ExportColumn } from "@/lib/exports";
import { db } from "@/lib/db";

type ExportFormat = "csv" | "excel" | "pdf";

const SUPPORTED_REPORTS = [
  "revenue", "footfall", "bookings", "payments",
  "food", "lockers", "rides", "staff-attendance",
  "crm", "maintenance", "loyalty", "pos", "parking",
] as const;

type ReportName = (typeof SUPPORTED_REPORTS)[number];

function isSupported(report: string): report is ReportName {
  return SUPPORTED_REPORTS.includes(report as ReportName);
}

async function fetchReportData(
  report: ReportName,
  dateFrom: Date,
  dateTo: Date
): Promise<{
  data: Record<string, unknown>[];
  columns: ExportColumn[];
  title: string;
}> {
  switch (report) {
    case "bookings": {
      const rows = await db.booking.findMany({
        where: { createdAt: { gte: dateFrom, lte: dateTo } },
        select: {
          bookingNumber: true,
          status: true,
          adults: true,
          children: true,
          totalAmount: true,
          visitDate: true,
          createdAt: true,
          guestName: true,
          guestMobile: true,
        },
        orderBy: { createdAt: "desc" },
      });
      return {
        title: "Bookings Report",
        columns: [
          { key: "bookingNumber", header: "Booking #", width: 18 },
          { key: "guestName", header: "Guest Name", width: 25 },
          { key: "guestMobile", header: "Mobile", width: 15 },
          { key: "visitDate", header: "Visit Date", width: 14 },
          { key: "adults", header: "Adults", width: 10 },
          { key: "children", header: "Children", width: 10 },
          { key: "totalAmount", header: "Amount (₹)", width: 14 },
          { key: "status", header: "Status", width: 14 },
        ],
        data: rows.map((r) => ({
          bookingNumber: r.bookingNumber,
          guestName: r.guestName ?? "—",
          guestMobile: r.guestMobile ?? "—",
          visitDate: r.visitDate.toISOString().slice(0, 10),
          adults: r.adults,
          children: r.children,
          totalAmount: Number(r.totalAmount),
          status: r.status,
        })),
      };
    }

    case "revenue": {
      const txs = await db.transaction.findMany({
        where: { status: "PAID", createdAt: { gte: dateFrom, lte: dateTo } },
        select: { createdAt: true, amount: true, method: true, status: true },
        orderBy: { createdAt: "desc" },
      });
      return {
        title: "Revenue Report",
        columns: [
          { key: "date", header: "Date", width: 14 },
          { key: "amount", header: "Amount (₹)", width: 14 },
          { key: "method", header: "Method", width: 16 },
          { key: "status", header: "Status", width: 12 },
        ],
        data: txs.map((t) => ({
          date: t.createdAt.toISOString().slice(0, 10),
          amount: Number(t.amount),
          method: t.method,
          status: t.status,
        })),
      };
    }

    case "footfall": {
      const bk = await db.booking.findMany({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          status: { not: "CANCELLED" },
        },
        select: { createdAt: true, adults: true, children: true, status: true },
        orderBy: { createdAt: "desc" },
      });
      return {
        title: "Footfall Report",
        columns: [
          { key: "date", header: "Date", width: 14 },
          { key: "adults", header: "Adults", width: 10 },
          { key: "children", header: "Children", width: 10 },
          { key: "total", header: "Total", width: 10 },
          { key: "status", header: "Status", width: 14 },
        ],
        data: bk.map((b) => ({
          date: b.createdAt.toISOString().slice(0, 10),
          adults: b.adults,
          children: b.children,
          total: b.adults + b.children,
          status: b.status,
        })),
      };
    }

    case "food": {
      const orders = await db.foodOrder.findMany({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          status: { not: "CANCELLED" },
        },
        include: { outlet: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      return {
        title: "Food & Beverage Report",
        columns: [
          { key: "date", header: "Date", width: 14 },
          { key: "token", header: "Token", width: 10 },
          { key: "outlet", header: "Outlet", width: 22 },
          { key: "guestName", header: "Guest", width: 22 },
          { key: "totalAmount", header: "Amount (₹)", width: 14 },
          { key: "paymentMethod", header: "Payment", width: 12 },
          { key: "status", header: "Status", width: 12 },
        ],
        data: orders.map((o) => ({
          date: o.createdAt.toISOString().slice(0, 10),
          token: o.token ?? "—",
          outlet: o.outlet.name,
          guestName: o.guestName,
          totalAmount: Number(o.totalAmount),
          paymentMethod: o.paymentMethod,
          status: o.status,
        })),
      };
    }

    case "lockers": {
      const assignments = await db.lockerAssignment.findMany({
        where: { assignedAt: { gte: dateFrom, lte: dateTo } },
        include: { locker: { include: { zone: { select: { name: true } } } } },
        orderBy: { assignedAt: "desc" },
      });
      return {
        title: "Locker Report",
        columns: [
          { key: "date", header: "Date", width: 14 },
          { key: "locker", header: "Locker #", width: 12 },
          { key: "zone", header: "Zone", width: 20 },
          { key: "size", header: "Size", width: 10 },
          { key: "guestName", header: "Guest", width: 22 },
          { key: "guestMobile", header: "Mobile", width: 14 },
          { key: "durationType", header: "Duration", width: 12 },
          { key: "amount", header: "Amount (₹)", width: 14 },
          { key: "returnedAt", header: "Returned At", width: 18 },
        ],
        data: assignments.map((a) => ({
          date: a.assignedAt.toISOString().slice(0, 10),
          locker: a.locker.number,
          zone: a.locker.zone.name,
          size: a.locker.size,
          guestName: a.guestName,
          guestMobile: a.guestMobile,
          durationType: a.durationType,
          amount: Number(a.amount),
          returnedAt: a.returnedAt?.toISOString() ?? "Active",
        })),
      };
    }

    case "staff-attendance": {
      const shifts = await db.shift.findMany({
        where: { shiftDate: { gte: dateFrom, lte: dateTo } },
        include: { staff: { include: { user: { select: { name: true, subRole: true } } } } },
        orderBy: { shiftDate: "desc" },
      });
      return {
        title: "Staff Attendance Report",
        columns: [
          { key: "date", header: "Date", width: 14 },
          { key: "name", header: "Staff Name", width: 22 },
          { key: "subRole", header: "Role", width: 18 },
          { key: "shiftType", header: "Shift", width: 12 },
          { key: "present", header: "Present", width: 10 },
          { key: "startTime", header: "Clock In", width: 18 },
          { key: "endTime", header: "Clock Out", width: 18 },
        ],
        data: shifts.map((s) => ({
          date: s.shiftDate.toISOString().slice(0, 10),
          name: s.staff.user.name,
          subRole: s.staff.user.subRole ?? "—",
          shiftType: s.shiftType,
          present: s.isPresent ? "Yes" : "No",
          startTime: s.startTime.toISOString().slice(11, 16),
          endTime: s.endTime ? s.endTime.toISOString().slice(11, 16) : "—",
        })),
      };
    }

    case "payments": {
      const txs = await db.transaction.findMany({
        where: { createdAt: { gte: dateFrom, lte: dateTo } },
        select: { createdAt: true, amount: true, method: true, status: true },
        orderBy: { createdAt: "desc" },
      });
      return {
        title: "Payments Report",
        columns: [
          { key: "date", header: "Date", width: 14 },
          { key: "amount", header: "Amount (₹)", width: 14 },
          { key: "method", header: "Method", width: 16 },
          { key: "status", header: "Status", width: 12 },
        ],
        data: txs.map((t) => ({
          date: t.createdAt.toISOString().slice(0, 10),
          amount: Number(t.amount),
          method: t.method,
          status: t.status,
        })),
      };
    }

    case "pos": {
      const txs = await db.transaction.findMany({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          posSessionId: { not: null },
        },
        select: {
          createdAt: true,
          amount: true,
          method: true,
          status: true,
          posSession: {
            select: {
              terminalId: true,
              staff: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return {
        title: "POS Report",
        columns: [
          { key: "date", header: "Date", width: 14 },
          { key: "terminal", header: "Terminal", width: 18 },
          { key: "staffName", header: "Staff", width: 22 },
          { key: "amount", header: "Amount (₹)", width: 14 },
          { key: "method", header: "Method", width: 16 },
          { key: "status", header: "Status", width: 12 },
        ],
        data: txs.map((t) => ({
          date: t.createdAt.toISOString().slice(0, 10),
          terminal: t.posSession?.terminalId ?? "—",
          staffName: t.posSession?.staff.name ?? "—",
          amount: Number(t.amount),
          method: t.method,
          status: t.status,
        })),
      };
    }

    case "crm": {
      const leads = await db.lead.findMany({
        where: { isDeleted: false, createdAt: { gte: dateFrom, lte: dateTo } },
        select: { id: true, name: true, mobile: true, stage: true, source: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      return {
        title: "CRM / Leads Report",
        columns: [
          { key: "name", header: "Lead Name", width: 22 },
          { key: "mobile", header: "Mobile", width: 14 },
          { key: "source", header: "Source", width: 14 },
          { key: "stage", header: "Stage", width: 16 },
          { key: "createdAt", header: "Created", width: 14 },
        ],
        data: leads.map((l) => ({
          name: l.name,
          mobile: l.mobile,
          source: l.source,
          stage: l.stage,
          createdAt: l.createdAt.toISOString().slice(0, 10),
        })),
      };
    }

    case "loyalty": {
      const txs = await db.loyaltyTransaction.findMany({
        where: { createdAt: { gte: dateFrom, lte: dateTo } },
        include: { guestProfile: { select: { name: true, mobile: true } } },
        orderBy: { createdAt: "desc" },
      });
      return {
        title: "Loyalty Report",
        columns: [
          { key: "date", header: "Date", width: 14 },
          { key: "guestName", header: "Guest", width: 22 },
          { key: "guestMobile", header: "Mobile", width: 14 },
          { key: "type", header: "Type", width: 12 },
          { key: "points", header: "Points", width: 10 },
        ],
        data: txs.map((t) => ({
          date: t.createdAt.toISOString().slice(0, 10),
          guestName: t.guestProfile.name,
          guestMobile: t.guestProfile.mobile,
          type: t.type,
          points: t.points,
        })),
      };
    }

    case "maintenance": {
      const workOrders = await db.workOrder.findMany({
        where: { createdAt: { gte: dateFrom, lte: dateTo } },
        include: { asset: { select: { name: true, assetType: true } } },
        orderBy: { createdAt: "desc" },
      });
      return {
        title: "Maintenance Cost Report",
        columns: [
          { key: "date", header: "Date", width: 14 },
          { key: "asset", header: "Asset", width: 22 },
          { key: "assetType", header: "Type", width: 16 },
          { key: "title", header: "Work Order", width: 28 },
          { key: "priority", header: "Priority", width: 12 },
          { key: "status", header: "Status", width: 12 },
          { key: "resolutionNotes", header: "Resolution", width: 36 },
        ],
        data: workOrders.map((w) => ({
          date: w.createdAt.toISOString().slice(0, 10),
          asset: w.asset.name,
          assetType: w.asset.assetType,
          title: w.title,
          priority: w.priority,
          status: w.status,
          resolutionNotes: w.resolutionNotes ?? "—",
        })),
      };
    }

    case "rides": {
      const logs = await db.rideAccessLog.findMany({
        where: { scannedAt: { gte: dateFrom, lte: dateTo } },
        include: { ride: { select: { name: true } } },
        orderBy: { scannedAt: "desc" },
      });
      // Group by ride
      const rideMap = new Map<string, { name: string; accesses: number }>();
      for (const log of logs) {
        const entry = rideMap.get(log.rideId) ?? { name: log.ride.name, accesses: 0 };
        entry.accesses++;
        rideMap.set(log.rideId, entry);
      }
      return {
        title: "Ride Popularity Report",
        columns: [
          { key: "rideName", header: "Ride", width: 28 },
          { key: "accesses", header: "Total Accesses", width: 18 },
        ],
        data: Array.from(rideMap.values()).sort((a, b) => b.accesses - a.accesses),
      };
    }

    case "parking": {
      const rows = await db.parkingTicket.findMany({
        where: {
          status: "EXITED",
          exitAt: { gte: dateFrom, lte: dateTo },
        },
        select: {
          ticketNumber: true,
          vehicleNumber: true,
          vehicleType: true,
          quantity: true,
          hours: true,
          paymentMethod: true,
          totalAmount: true,
          entryAt: true,
          exitAt: true,
        },
        orderBy: { exitAt: "desc" },
      });

      return {
        title: "Parking Report",
        columns: [
          { key: "ticketNumber", header: "Ticket #", width: 20 },
          { key: "vehicleNumber", header: "Vehicle", width: 20 },
          { key: "vehicleType", header: "Type", width: 16 },
          { key: "quantity", header: "Qty", width: 8 },
          { key: "hours", header: "Hours", width: 8 },
          { key: "paymentMethod", header: "Payment", width: 16 },
          { key: "totalAmount", header: "Amount (₹)", width: 14 },
          { key: "entryAt", header: "Entry", width: 20 },
          { key: "exitAt", header: "Exit", width: 20 },
        ],
        data: rows.map((row) => ({
          ticketNumber: row.ticketNumber,
          vehicleNumber: row.vehicleNumber,
          vehicleType: row.vehicleType,
          quantity: row.quantity,
          hours: row.hours ?? "—",
          paymentMethod: row.paymentMethod ?? "—",
          totalAmount: Number(row.totalAmount),
          entryAt: row.entryAt.toISOString(),
          exitAt: row.exitAt?.toISOString() ?? "—",
        })),
      };
    }

    default:
      return { data: [], columns: [], title: "Report" };
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ report: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { report } = await params;

  if (!isSupported(report)) {
    return new Response(JSON.stringify({ error: "Unknown report" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") ?? "csv") as ExportFormat;
  const { dateFrom, dateTo } = buildDateRange(
    searchParams.get("dateFrom"),
    searchParams.get("dateTo")
  );

  const { data, columns, title } = await fetchReportData(report, dateFrom, dateTo);
  const filename = `${report}-${dateFrom.toISOString().slice(0, 10)}_${dateTo.toISOString().slice(0, 10)}`;

  if (format === "excel") return exportToExcel(data, columns, title, filename);
  if (format === "pdf") return exportToPDF(data, columns, title, filename);
  return exportToCSV(data, columns, filename);
}
