"use client";

import { Suspense, useEffect, useState } from "react";

import { useSearchParams } from "next/navigation";

function MagicTokenHandler(): JSX.Element {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const callbackURL = searchParams.get("callbackURL") ?? "/";

    async function run(): Promise<void> {
      if (!token) {
        setError("Missing token");
        return;
      }

      const url = new URL("/api/auth/magic-link/verify", window.location.origin);
      url.searchParams.set("token", token);
      url.searchParams.set("callbackURL", callbackURL);

      const response = await fetch(url.toString());
      if (!response.ok) {
        setError("Invalid or expired magic link");
        return;
      }

      window.location.href = callbackURL;
    }

    void run();
  }, [searchParams]);

  return (
    <div className="mx-auto max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
      {error ? <p className="text-red-500">{error}</p> : <p>Verifying your login link...</p>}
    </div>
  );
}

export default function MagicTokenHandlerPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
          <p>Verifying your login link...</p>
        </div>
      }
    >
      <MagicTokenHandler />
    </Suspense>
  );
}
