"use client";

import { useState } from "react";

import { MagicLinkForm } from "@/components/auth/MagicLinkForm";

export default function MagicLinkLoginPage(): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  return (
    <div className="space-y-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <h1 className="text-xl font-semibold">Magic Link Login</h1>
      <MagicLinkForm
        loading={loading}
        message={message}
        error={error}
        onSubmit={async (email) => {
          setLoading(true);
          setMessage(undefined);
          setError(undefined);
          try {
            const response = await fetch("/api/auth/magic-link/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });

            if (!response.ok) {
              setError("Failed to send link");
              return;
            }

            setMessage("Check your email for your login link.");
          } finally {
            setLoading(false);
          }
        }}
      />
    </div>
  );
}
