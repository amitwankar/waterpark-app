"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { StaffNav } from "@/components/staff/StaffNav";
import { ToastProvider } from "@/components/feedback/Toast";
import { authClient } from "@/lib/auth-client";

function StaffShell({ children }: { children: React.ReactNode }): JSX.Element {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const pathname = usePathname();
  const userWithSubRole = session?.user as { subRole?: string } | undefined;
  const role = String(session?.user?.role ?? "");
  const isPosRoute = pathname?.startsWith("/staff/pos");
  const [checkingPosLock, setCheckingPosLock] = useState(true);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.replace(`/login?returnUrl=${encodeURIComponent(pathname || "/staff/pos")}`);
      return;
    }
    if (!["ADMIN", "EMPLOYEE"].includes(role)) {
      router.replace("/login");
    }
  }, [isPending, pathname, role, router, session?.user]);

  useEffect(() => {
    let cancelled = false;

    async function enforcePosLock(): Promise<void> {
      if (isPending) return;
      if (!session?.user || !["ADMIN", "EMPLOYEE"].includes(role)) {
        if (!cancelled) setCheckingPosLock(false);
        return;
      }

      setCheckingPosLock(true);
      try {
        const response = await fetch("/api/v1/pos/sessions/active-staff", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { session?: { redirectTo?: string } | null }
          | null;

        const redirectTo = payload?.session?.redirectTo;
        if (!isPosRoute && typeof redirectTo === "string" && redirectTo.startsWith("/")) {
          router.replace(redirectTo);
          return;
        }
      } catch {
        // Non-fatal fallback: route-level checks remain active.
      } finally {
        if (!cancelled) setCheckingPosLock(false);
      }
    }

    void enforcePosLock();
    return () => {
      cancelled = true;
    };
  }, [isPending, isPosRoute, pathname, role, router, session?.user]);

  if (isPending || !session?.user || !["ADMIN", "EMPLOYEE"].includes(role) || checkingPosLock) {
    return <div className="min-h-screen bg-[var(--color-surface-muted)] p-4 lg:p-6" />;
  }

  return (
    <div
      className={
        isPosRoute
          ? "flex h-screen flex-col overflow-hidden bg-[var(--color-surface-muted)]"
          : "min-h-screen bg-[var(--color-surface-muted)]"
      }
    >
      <StaffNav
        userId={session?.user?.id}
        role={role}
        subRole={String(userWithSubRole?.subRole ?? "")}
        userName={session?.user?.name}
      />
      <main className={isPosRoute ? "flex-1 overflow-auto p-3 lg:p-4" : "p-4 lg:p-6"}>{children}</main>
    </div>
  );
}

export default function StaffLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <ToastProvider>
      <Suspense fallback={<div className="min-h-screen bg-[var(--color-surface-muted)] p-4 lg:p-6" />}>
        <StaffShell>{children}</StaffShell>
      </Suspense>
    </ToastProvider>
  );
}
