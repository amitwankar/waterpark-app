"use client";

import { Suspense } from "react";
import type { ReactNode } from "react";

import { ToastProvider } from "@/components/feedback/Toast";
import { GuestHeader } from "@/components/guest/GuestHeader";
import { authClient } from "@/lib/auth-client";

export function GuestShell({ children }: { children: ReactNode }): JSX.Element {
  const { data: session } = authClient.useSession();

  return (
    <ToastProvider>
      <Suspense fallback={<div className="min-h-screen bg-[var(--color-surface-muted)] p-4 lg:p-6" />}>
        <div className="min-h-screen bg-[var(--color-surface-muted)]">
          <GuestHeader authenticated={Boolean(session?.user)} />
          <main className="mx-auto w-full max-w-6xl p-4 lg:p-6">{children}</main>
        </div>
      </Suspense>
    </ToastProvider>
  );
}
