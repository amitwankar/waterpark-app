import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(1200px_500px_at_12%_-10%,rgba(20,184,166,0.16),transparent_60%),radial-gradient(900px_420px_at_92%_4%,rgba(245,158,11,0.12),transparent_60%),linear-gradient(180deg,var(--color-surface-muted),var(--color-surface))] px-4 py-8 sm:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[linear-gradient(180deg,rgba(20,184,166,0.08),transparent)]"
      />
      <div className="relative mx-auto max-w-5xl">
        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden space-y-4 lg:block">
            <p className="inline-flex items-center rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal-700 dark:text-teal-300">
              AquaWorld Operations
            </p>
            <h2 className="max-w-xl text-4xl font-semibold leading-tight text-[var(--color-text)]">
              Secure access for ticketing, POS, and park management.
            </h2>
            <p className="max-w-lg text-base text-[var(--color-text-muted)]">
              Use your assigned staff account to continue. Guests can browse public pages and submit inquiry forms.
            </p>
            <div className="grid max-w-lg grid-cols-3 gap-3 pt-2 text-sm">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-3 shadow-[var(--shadow-card)] backdrop-blur">
                <p className="font-semibold text-[var(--color-text)]">Secure Login</p>
                <p className="text-[var(--color-text-muted)]">Email, OTP, Magic Link</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-3 shadow-[var(--shadow-card)] backdrop-blur">
                <p className="font-semibold text-[var(--color-text)]">Role Access</p>
                <p className="text-[var(--color-text-muted)]">Admin and staff scoped</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-3 shadow-[var(--shadow-card)] backdrop-blur">
                <p className="font-semibold text-[var(--color-text)]">Audit Ready</p>
                <p className="text-[var(--color-text-muted)]">Tracked session activity</p>
              </div>
            </div>
          </section>

          <div className="mx-auto w-full max-w-md rounded-2xl border border-[var(--color-border)]/80 bg-[var(--color-surface)]/92 p-5 shadow-[var(--shadow-modal)] backdrop-blur sm:p-6">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
