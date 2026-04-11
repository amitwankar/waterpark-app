"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // Keep lightweight dev diagnostics without polluting production console.
      // eslint-disable-next-line no-console
      console.warn("[global-error]", {
        message: error.message,
        digest: error.digest,
      });
    }
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 bg-[var(--color-surface-muted)] px-6 text-center">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">Something went wrong</h1>
      <p className="text-sm text-[var(--color-text-muted)]">
        An unexpected error occurred. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
