import { Suspense } from "react";

import { LoginTabs } from "@/components/auth/LoginTabs";

export default function LoginPage(): JSX.Element {
  return (
    <div className="space-y-5">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">Welcome back</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Sign in to continue to AquaWorld operations</p>
        <p className="text-xs text-[var(--color-text-muted)]">Admin and staff accounts only</p>
      </div>
      <Suspense
        fallback={
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm text-[var(--color-text-muted)]">
            Loading login...
          </div>
        }
      >
        <LoginTabs />
      </Suspense>
    </div>
  );
}
