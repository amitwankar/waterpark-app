"use client";

import { useState } from "react";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage(): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  return (
    <div className="space-y-5">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">Forgot password</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Enter your email and we’ll send a reset link.</p>
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
      <ForgotPasswordForm
        loading={loading}
        message={message}
        error={error}
        onSubmit={async (email) => {
          setLoading(true);
          setMessage(undefined);
          setError(undefined);
          try {
            const response = await fetch("/api/auth/forgot-password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });

            if (!response.ok) {
              setError("Could not process request");
              return;
            }

            setMessage("If the account exists, a reset link has been sent.");
          } finally {
            setLoading(false);
          }
        }}
      />
      </div>
    </div>
  );
}
