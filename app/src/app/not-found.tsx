import Link from "next/link";

import { Button } from "@/components/ui/Button";

export default function NotFound(): JSX.Element {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="rounded-full bg-[var(--color-primary-light)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
        404
      </p>
      <h1 className="text-3xl font-semibold text-[var(--color-text)]">Page not found</h1>
      <p className="text-sm text-[var(--color-text-muted)]">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/">
        <Button>Go to dashboard</Button>
      </Link>
    </main>
  );
}
