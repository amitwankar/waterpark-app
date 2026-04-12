"use client";

import { Bell, ChevronDown, ChevronRight, Menu, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface AdminHeaderProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenMobileSidebar: () => void;
  userName?: string | null;
}

function labelFromSegment(segment: string): string {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

interface HeaderNotificationItem {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
}

const NOTIF_READ_IDS_KEY = "wp.admin.notifications.readIds";

function getReadNotificationIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(NOTIF_READ_IDS_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set<string>();
  }
}

function saveReadNotificationIds(ids: Set<string>): void {
  const compact = Array.from(ids).slice(-300);
  window.localStorage.setItem(NOTIF_READ_IDS_KEY, JSON.stringify(compact));
}

const QUICK_SEARCH_ROUTES: Array<{ label: string; href: string; keywords: string[] }> = [
  { label: "Dashboard", href: "/admin/dashboard", keywords: ["dashboard", "home", "overview"] },
  { label: "Bookings", href: "/admin/bookings", keywords: ["booking", "bookings", "reservation"] },
  { label: "Tickets", href: "/admin/tickets", keywords: ["ticket", "ticket types", "passes"] },
  { label: "Packages", href: "/admin/packages", keywords: ["package", "packages", "bundle", "offer"] },
  { label: "Payments", href: "/admin/payments", keywords: ["payment", "transactions", "finance"] },
  { label: "Rides", href: "/admin/rides", keywords: ["ride", "rides", "queue"] },
  { label: "Food", href: "/admin/food", keywords: ["food", "beverage", "fnb"] },
  { label: "Lockers", href: "/admin/lockers", keywords: ["locker", "lockers"] },
  { label: "Costumes", href: "/admin/costumes", keywords: ["costume", "rental"] },
  { label: "CRM Leads", href: "/admin/crm/leads", keywords: ["lead", "crm", "follow up"] },
  { label: "CRM Guests", href: "/admin/crm/guests", keywords: ["guest", "crm"] },
  { label: "Campaigns", href: "/admin/campaigns", keywords: ["campaign", "message", "communication"] },
  { label: "Reports", href: "/admin/reports", keywords: ["report", "analytics"] },
  { label: "Settings", href: "/admin/settings", keywords: ["settings", "config", "configuration"] },
];

export function AdminHeader({
  collapsed,
  onToggleCollapsed,
  onOpenMobileSidebar,
  userName,
}: AdminHeaderProps): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [openUser, setOpenUser] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState<HeaderNotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [lastDismissed, setLastDismissed] = useState<HeaderNotificationItem | null>(null);
  const notifPanelRef = useRef<HTMLDivElement | null>(null);
  const userPanelRef = useRef<HTMLDivElement | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  const breadcrumb = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean).slice(1);
    return ["Admin", ...parts.map(labelFromSegment)];
  }, [pathname]);

  const quickSearchSuggestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return QUICK_SEARCH_ROUTES.slice(0, 6);
    return QUICK_SEARCH_ROUTES.filter((item) =>
      item.label.toLowerCase().includes(term) || item.keywords.some((key) => key.includes(term)),
    ).slice(0, 8);
  }, [search]);

  async function loadNotifications(): Promise<void> {
    setNotificationsLoading(true);
    try {
      const response = await fetch("/api/v1/settings/audit-log?page=1&pageSize=8");
      const payload = (await response.json().catch(() => null)) as { rows?: Array<Record<string, unknown>> } | null;
      const rows = (payload?.rows ?? []) as Array<{ id: string; action: string; entity: string; createdAt: string }>;
      const readIds = getReadNotificationIds();
      const unreadRows = rows.filter((row) => !readIds.has(row.id));
      setNotifications(unreadRows.map((row) => ({
        id: row.id,
        action: row.action,
        entity: row.entity,
        createdAt: row.createdAt,
      })));
      setUnreadCount(unreadRows.length);
    } finally {
      setNotificationsLoading(false);
    }
  }

  function markNotificationRead(id: string): void {
    const target = notifications.find((item) => item.id === id) ?? null;
    const readIds = getReadNotificationIds();
    readIds.add(id);
    saveReadNotificationIds(readIds);
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setLastDismissed(target);
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => setLastDismissed(null), 5000);
  }

  function markNotificationsRead(): void {
    if (notifications.length === 0) return;
    const readIds = getReadNotificationIds();
    for (const notification of notifications) {
      readIds.add(notification.id);
    }
    saveReadNotificationIds(readIds);
    setNotifications([]);
    setUnreadCount(0);
    setLastDismissed(null);
  }

  function undoMarkRead(): void {
    if (!lastDismissed) return;
    const readIds = getReadNotificationIds();
    readIds.delete(lastDismissed.id);
    saveReadNotificationIds(readIds);
    setNotifications((prev) => {
      if (prev.some((item) => item.id === lastDismissed.id)) return prev;
      const next = [lastDismissed, ...prev].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      return next.slice(0, 8);
    });
    setUnreadCount((prev) => prev + 1);
    setLastDismissed(null);
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }

  function handleSearchSubmit(): void {
    const term = search.trim();
    if (!term) return;
    const exact = QUICK_SEARCH_ROUTES.find((item) => item.label.toLowerCase() === term.toLowerCase());
    if (exact) {
      router.push(exact.href);
      return;
    }
    if (/^AWP-\d{8}-/i.test(term)) {
      router.push(`/admin/bookings?search=${encodeURIComponent(term)}`);
      return;
    }
    router.push(`/admin/bookings?search=${encodeURIComponent(term)}`);
  }

  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(() => {
      void loadNotifications();
    }, 45000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (notifPanelRef.current && !notifPanelRef.current.contains(target)) {
        setOpenNotifications(false);
      }
      if (userPanelRef.current && !userPanelRef.current.contains(target)) {
        setOpenUser(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleLogout(): Promise<void> {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="rounded-[var(--radius-md)] p-2 text-[var(--color-text-muted)] transition hover:bg-zinc-100 hover:text-[var(--color-text)] lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden rounded-[var(--radius-md)] p-2 text-[var(--color-text-muted)] transition hover:bg-zinc-100 hover:text-[var(--color-text)] lg:inline-flex"
          >
            <Menu className={cn("h-4 w-4 transition-transform duration-200", collapsed ? "rotate-180" : "rotate-0")} />
          </button>

          <div className="hidden items-center text-sm text-[var(--color-text-muted)] sm:flex">
            {breadcrumb.map((item, index) => (
              <span key={`${item}-${index}`} className="inline-flex items-center gap-1">
                {index > 0 ? <ChevronRight className="h-3.5 w-3.5" /> : null}
                <span className={index === breadcrumb.length - 1 ? "font-semibold text-[var(--color-text)]" : ""}>{item}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative hidden md:block">
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-2 text-sm text-[var(--color-text-muted)]">
            <Search className="h-4 w-4" />
            <input
              className="w-44 bg-transparent text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
              placeholder="Search pages / booking id"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSearchSubmit();
                }
              }}
            />
              <button
                type="button"
                onClick={handleSearchSubmit}
                className="rounded px-1 py-0.5 text-xs text-[var(--color-text-muted)] hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Go
              </button>
            </div>
            {search.trim().length > 0 ? (
              <div className="absolute right-0 top-11 z-40 w-72 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-card)]">
                {quickSearchSuggestions.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">No matching pages</p>
                ) : (
                  quickSearchSuggestions.map((item) => (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => {
                        setSearch("");
                        router.push(item.href);
                      }}
                      className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm text-[var(--color-text)] hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {item.label}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <div className="relative" ref={notifPanelRef}>
            <Button
              variant="ghost"
              size="sm"
              className="relative h-9 w-9 p-0"
              onClick={() => {
                setOpenNotifications((state) => !state);
              }}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--color-secondary)]" /> : null}
            </Button>
            {openNotifications ? (
              <div className="absolute right-0 mt-2 w-80 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-card)]">
                <div className="mb-1 flex items-center justify-between px-1">
                  <p className="text-sm font-semibold text-[var(--color-text)]">Notifications</p>
                  <button
                    type="button"
                    onClick={markNotificationsRead}
                    className="text-xs text-[var(--color-primary)]"
                  >
                    Mark all read
                  </button>
                </div>
                {notificationsLoading ? (
                  <p className="px-2 py-4 text-xs text-[var(--color-text-muted)]">Loading...</p>
                ) : notifications.length === 0 ? (
                  <div className="space-y-2 px-2 py-3">
                    <p className="text-xs text-[var(--color-text-muted)]">No notifications</p>
                    {lastDismissed ? (
                      <button
                        type="button"
                        onClick={undoMarkRead}
                        className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--color-primary)]"
                      >
                        Undo last mark read
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="max-h-80 space-y-1 overflow-y-auto">
                    {notifications.map((item) => (
                      <div key={item.id} className="rounded-[var(--radius-sm)] px-2 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-[var(--color-text)]">{item.action}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {item.entity} · {new Date(item.createdAt).toLocaleString("en-IN")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => markNotificationRead(item.id)}
                            className="text-[11px] font-medium text-[var(--color-primary)] hover:underline"
                          >
                            Mark read
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {notifications.length > 0 && lastDismissed ? (
                  <div className="mt-2 border-t border-[var(--color-border)] px-1 pt-2">
                    <button
                      type="button"
                      onClick={undoMarkRead}
                      className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--color-primary)]"
                    >
                      Undo last mark read
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="relative" ref={userPanelRef}>
            <button
              type="button"
              onClick={() => setOpenUser((state) => !state)}
              className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <span className="hidden sm:block">{userName ?? "Admin User"}</span>
              <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
            </button>
            {openUser ? (
              <div className="absolute right-0 mt-2 w-40 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-card)]">
                <button
                  type="button"
                  onClick={() => {
                    setOpenUser(false);
                    router.push("/admin/settings");
                  }}
                  className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Profile
                </button>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                  className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-zinc-800"
                >
                  {loggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
