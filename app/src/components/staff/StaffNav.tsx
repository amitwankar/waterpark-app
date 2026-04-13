"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Clock3, Moon, ScanLine, Sun } from "lucide-react";

import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface StaffNavProps {
  userId?: string | null;
  role?: string | null;
  subRole?: string | null;
  userName?: string | null;
}

interface StaffNavItem {
  href: string;
  label: string;
  /** undefined = visible to all; defined = visible only to listed subRoles (ADMIN always included) */
  subRoles?: string[];
  icon?: React.ComponentType<{ className?: string }>;
}

const QR_SCAN_ROLES = ["RIDE_OPERATOR", "SECURITY_STAFF", "TICKET_COUNTER", "LOCKER_ATTENDANT", "COSTUME_ATTENDANT", "ADMIN"];

const items: StaffNavItem[] = [
  { href: "/staff/pos", label: "POS", subRoles: ["TICKET_COUNTER", "SALES_EXECUTIVE", "ADMIN"] },
  { href: "/staff/scan", label: "QR Scan", subRoles: QR_SCAN_ROLES, icon: ScanLine },
  { href: "/staff/rides", label: "Rides", subRoles: ["RIDE_OPERATOR", "SECURITY_STAFF", "ADMIN"] },
  { href: "/staff/food", label: "Food", subRoles: ["FB_STAFF", "ADMIN"] },
  { href: "/staff/lockers", label: "Lockers", subRoles: ["LOCKER_ATTENDANT", "ADMIN"] },
  { href: "/staff/costumes", label: "Costumes", subRoles: ["COSTUME_ATTENDANT", "ADMIN"] },
  { href: "/staff/maintenance", label: "Maintenance", subRoles: ["MAINTENANCE_TECH", "ADMIN"] },
];

type ThemeMode = "light" | "dark";

export function StaffNav({ userId, role, subRole, userName }: StaffNavProps): JSX.Element {
  const pathname = usePathname();
  const { pushToast } = useToast();
  const [clockingIn, setClockingIn] = useState(false);
  const [clockedInToday, setClockedInToday] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    const saved = window.localStorage.getItem("wp.theme.mode");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const effectiveSubRole = role === "ADMIN" ? "ADMIN" : subRole ?? "";
  const staffUserId = userId ?? null;

  const visibleItems = items.filter((item) => !item.subRoles || item.subRoles.includes(effectiveSubRole));

  const shiftType = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "MORNING";
    if (hour < 17) return "AFTERNOON";
    if (hour < 22) return "EVENING";
    return "NIGHT";
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("theme-dark", themeMode === "dark");
    root.classList.toggle("theme-light", themeMode === "light");
    window.localStorage.setItem("wp.theme.mode", themeMode);
  }, [themeMode]);

  async function handleClockIn(): Promise<void> {
    if (!staffUserId || clockingIn || clockedInToday) return;

    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const shiftDate = `${y}-${m}-${d}`;

    setClockingIn(true);
    try {
      const response = await fetch("/api/v1/staff/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffUserId,
          shiftType,
          shiftDate,
          notes: "Clocked in from staff header",
        }),
      });

      if (response.status === 409) {
        setClockedInToday(true);
        pushToast({ title: "Already clocked in for this shift", variant: "info" });
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Clock in failed");
      }

      setClockedInToday(true);
      pushToast({ title: "Clocked in successfully", message: `${shiftType} shift`, variant: "success" });
    } catch (error) {
      pushToast({
        title: "Clock in failed",
        message: error instanceof Error ? error.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setClockingIn(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-1 overflow-x-auto">
          {visibleItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium transition duration-150",
                  active
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-text-muted)] hover:bg-zinc-100 hover:text-[var(--color-text)] dark:hover:bg-zinc-800",
                )}
              >
                {item.icon ? <item.icon className="h-3.5 w-3.5 shrink-0" /> : null}
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-[var(--color-text-muted)] md:block">{userName ?? "Staff"}</span>
          <button
            type="button"
            onClick={() => setThemeMode((current) => (current === "dark" ? "light" : "dark"))}
            className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
          >
            {themeMode === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {themeMode === "dark" ? "Light" : "Dark"}
          </button>
          <Button variant="secondary" size="sm" onClick={() => void handleClockIn()} loading={clockingIn} disabled={!staffUserId || clockedInToday}>
            <Clock3 className="h-4 w-4" />
            {clockedInToday ? "Clocked In" : "Clock In"}
          </Button>
        </div>
      </div>
    </header>
  );
}
