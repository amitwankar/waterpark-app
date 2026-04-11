import {
  BarChart3,
  Users,
  CalendarCheck,
  CreditCard,
  Utensils,
  Lock,
  Zap,
  UserCheck,
  TrendingUp,
  Wrench,
  Star,
  Shirt,
  MonitorSmartphone,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ReportCard } from "@/components/reports/ReportCard";

const REPORTS = [
  {
    href: "/admin/reports/revenue",
    icon: BarChart3,
    title: "Revenue",
    description: "Total revenue by payment method with daily trend line.",
  },
  {
    href: "/admin/reports/footfall",
    icon: Users,
    title: "Footfall / Attendance",
    description: "Visitor count by day — adults, children, peak analysis.",
  },
  {
    href: "/admin/reports/bookings",
    icon: CalendarCheck,
    title: "Bookings",
    description: "Booking status distribution, conversion rate, daily trend.",
  },
  {
    href: "/admin/reports/payments",
    icon: CreditCard,
    title: "Payments",
    description: "Breakdown by method — gateway, UPI, cash, pending.",
  },
  {
    href: "/admin/reports/pos",
    icon: MonitorSmartphone,
    title: "POS Collections",
    description: "POS-wise and staff-wise collection, sessions, and payment method split.",
  },
  {
    href: "/admin/reports/food",
    icon: Utensils,
    title: "Food & Beverage",
    description: "Revenue per outlet, top items, order volumes.",
  },
  {
    href: "/admin/reports/lockers",
    icon: Lock,
    title: "Lockers",
    description: "Assignment count, revenue, average duration by size.",
  },
  {
    href: "/admin/reports/rides",
    icon: Zap,
    title: "Ride Popularity",
    description: "Access logs per ride, busiest rides, downtime hours.",
  },
  {
    href: "/admin/reports/staff-attendance",
    icon: UserCheck,
    title: "Staff Attendance",
    description: "Present/absent per day, average hours, calendar heatmap.",
  },
  {
    href: "/admin/reports/crm",
    icon: TrendingUp,
    title: "CRM / Lead Conversion",
    description: "Pipeline funnel, source breakdown, conversion rate.",
  },
  {
    href: "/admin/reports/maintenance",
    icon: Wrench,
    title: "Maintenance Costs",
    description: "Work order costs by asset type, open & overdue WOs.",
  },
  {
    href: "/admin/reports/loyalty",
    icon: Star,
    title: "Guest Loyalty",
    description: "Points issued vs redeemed, tier breakdown, active members.",
  },
  {
    href: "/admin/reports/costumes",
    icon: Shirt,
    title: "Costume Rental",
    description: "Daily rental volumes, revenue, deposit collection, and top items.",
  },
];

export default function ReportsLandingPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        subtitle="13 pre-built reports with CSV, Excel, and PDF export."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((report) => (
          <ReportCard key={report.href} {...report} />
        ))}
      </div>
    </div>
  );
}
