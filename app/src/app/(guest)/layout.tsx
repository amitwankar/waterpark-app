"use client";

import { Suspense } from "react";

import { GuestHeader } from "@/components/guest/GuestHeader";
import { ToastProvider } from "@/components/feedback/Toast";
import { authClient } from "@/lib/auth-client";

function GuestShell({ children }: { children: React.ReactNode }): JSX.Element {
  const { data: session } = authClient.useSession();

  return (
    <div className="min-h-screen bg-[var(--color-surface-muted)]">
      <GuestHeader authenticated={Boolean(session?.user)} />
      <main className="mx-auto w-full max-w-6xl p-4 lg:p-6">{children}</main>
    </div>
  );
}

export default function GuestLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <ToastProvider>
      <Suspense fallback={<div className="min-h-screen bg-[var(--color-surface-muted)] p-4 lg:p-6" />}>
        <GuestShell>{children}</GuestShell>
      </Suspense>
    </ToastProvider>
  );
}
