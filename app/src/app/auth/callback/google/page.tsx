"use client";

import { useEffect } from "react";

export default function GoogleCallbackPage(): JSX.Element {
  useEffect(() => {
    const returnUrl = new URLSearchParams(window.location.search).get("returnUrl") ?? "/";
    const timeout = window.setTimeout(() => {
      window.location.href = returnUrl;
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="mx-auto max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
      <p>Signing you in with Google...</p>
    </div>
  );
}
