import Link from "next/link";

import { Button } from "@/components/ui/Button";

export interface GuestHeaderProps {
  authenticated?: boolean;
}

export function GuestHeader({ authenticated }: GuestHeaderProps): JSX.Element {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 lg:px-6">
        <Link href="/" className="text-base font-semibold text-[var(--color-primary)]">
          Waterpark Pro
        </Link>

        <nav className="flex items-center gap-2">
          <Link href="/guest/my-account/bookings" className="rounded-[var(--radius-md)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] transition hover:bg-zinc-100 hover:text-[var(--color-text)] dark:hover:bg-zinc-800">
            My Bookings
          </Link>
          {authenticated ? (
            <Button variant="outline" size="sm">My Account</Button>
          ) : (
            <Link href="/login">
              <Button size="sm">Login</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}