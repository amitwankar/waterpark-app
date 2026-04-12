"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  LayoutGrid,
  Megaphone,
  Settings,
  Ticket,
  Users,
  Wrench,
  Utensils,
  Waves,
  Map,
  CreditCard,
  Shield,
  UserCog,
  BarChart3,
  Lock,
  Percent,
  Shirt,
  MonitorSmartphone,
  ScanLine,
  Package,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export interface SidebarUser {
  name?: string | null;
  role?: string | null;
}

export interface SidebarProps {
  collapsed: boolean;
  pendingUpiCount?: number;
  user?: SidebarUser;
  mobile?: boolean;
}

interface SidebarItem {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  badge?: string;
}

interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

function getGroups(): SidebarGroup[] {
  return [
    {
      title: "Overview",
      items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutGrid }],
    },
    {
      title: "Terminal",
      items: [
        { href: "/staff/pos", label: "POS Terminal", icon: MonitorSmartphone },
        { href: "/staff/scan", label: "QR Scanner", icon: ScanLine },
      ],
    },
    {
      title: "Sales",
      items: [
        { href: "/admin/bookings", label: "Bookings", icon: ClipboardList },
        { href: "/admin/bookings/pos", label: "POS Bookings", icon: ClipboardList },
        { href: "/admin/tickets", label: "Ticket Types", icon: Ticket },
        { href: "/admin/packages", label: "Packages", icon: Package },
        { href: "/admin/coupons", label: "Coupons", icon: Percent },
      ],
    },
    {
      title: "Operations",
      items: [
        { href: "/admin/rides", label: "Rides", icon: Waves },
        { href: "/admin/zones", label: "Zones", icon: Map },
        { href: "/admin/food", label: "Food & Beverage", icon: Utensils },
        { href: "/admin/lockers", label: "Lockers", icon: Lock },
        { href: "/admin/costumes", label: "Costume Rental", icon: Shirt },
      ],
    },
    {
      title: "Finance",
      items: [
        { href: "/admin/payments", label: "Payments", icon: CreditCard },
      ],
    },
    {
      title: "People",
      items: [
        { href: "/admin/staff", label: "Staff", icon: UserCog },
        { href: "/admin/crm/guests", label: "CRM Guests", icon: Users },
        { href: "/admin/crm/leads", label: "CRM Leads", icon: Shield },
        { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
      ],
    },
    {
      title: "Maintenance",
      items: [
        { href: "/admin/maintenance/assets", label: "Assets", icon: Wrench },
        { href: "/admin/maintenance/work-orders", label: "Work Orders", icon: ClipboardList },
      ],
    },
    {
      title: "Reports",
      items: [{ href: "/admin/reports", label: "Reports", icon: BarChart3 }],
    },
    {
      title: "Settings",
      items: [{ href: "/admin/settings", label: "Settings", icon: Settings }],
    },
  ];
}

export function Sidebar({ collapsed, user, mobile }: SidebarProps): JSX.Element {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-200",
        mobile
          ? "flex h-screen w-full flex-col"
          : "hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:self-start",
        collapsed && !mobile ? "w-16" : "w-64",
      )}
    >
      <div className="border-b border-[var(--color-border)] px-4 py-4">
        <p className={cn("font-semibold text-[var(--color-text)]", collapsed ? "text-xs" : "text-base")}>{collapsed ? "WP" : "Waterpark Pro"}</p>
        {!collapsed ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">{user?.name ?? "Admin"}</p> : null}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
        {getGroups().map((group) => (
          <div key={group.title}>
            {!collapsed ? <p className="px-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">{group.title}</p> : null}
            <ul className="mt-1 space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center rounded-[var(--radius-md)] px-2 py-2 text-sm font-medium transition-all duration-150",
                        active
                          ? "bg-[var(--color-primary)] text-white"
                          : "text-[var(--color-text-muted)] hover:bg-zinc-100 hover:text-[var(--color-text)] dark:hover:bg-zinc-800",
                        collapsed ? "justify-center" : "justify-between",
                      )}
                    >
                      <span className={cn("flex items-center", collapsed ? "justify-center" : "gap-2")}>
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed ? <span>{item.label}</span> : null}
                      </span>
                      {!collapsed && item.badge ? <Badge variant="warning">{item.badge}</Badge> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!collapsed ? (
        <div className="border-t border-[var(--color-border)] p-3 text-xs text-[var(--color-text-muted)]">Role: {user?.role ?? "ADMIN"}</div>
      ) : null}
    </aside>
  );
}
