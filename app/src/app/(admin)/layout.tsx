"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AdminHeader } from "@/components/admin/Header";
import { MobileSidebar } from "@/components/admin/MobileSidebar";
import { Sidebar } from "@/components/admin/Sidebar";
import { ToastProvider } from "@/components/feedback/Toast";
import { authClient } from "@/lib/auth-client";

function AdminShell({ children }: { children: React.ReactNode }): JSX.Element {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("wp.admin.sidebar.collapsed");
    if (saved === "1") {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("wp.admin.sidebar.collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.replace(`/login?returnUrl=${encodeURIComponent(pathname || "/admin/dashboard")}`);
      return;
    }
    if (session.user.role !== "ADMIN") {
      router.replace("/staff/pos");
    }
  }, [isPending, pathname, router, session?.user]);

  if (isPending || !session?.user || session.user.role !== "ADMIN") {
    return <div className="min-h-screen bg-[var(--color-surface-muted)] p-4 lg:p-6" />;
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-surface-muted)]">
      <Sidebar collapsed={collapsed} pendingUpiCount={0} user={{ name: session?.user?.name, role: String(session?.user?.role ?? "ADMIN") }} />

      <div className="flex min-h-screen flex-1 flex-col">
        <AdminHeader
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((state) => !state)}
          onOpenMobileSidebar={() => setMobileOpen(true)}
          userName={session?.user?.name}
        />

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>

      <MobileSidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        pendingUpiCount={0}
        userName={session?.user?.name}
        userRole={String(session?.user?.role ?? "ADMIN")}
      />
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <ToastProvider>
      <Suspense fallback={<div className="min-h-screen bg-[var(--color-surface-muted)] p-4 lg:p-6" />}>
        <AdminShell>{children}</AdminShell>
      </Suspense>
    </ToastProvider>
  );
}
