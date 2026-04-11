"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function SetPasswordContent(): JSX.Element {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  return (
    <div className="space-y-5">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">Set your password</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Activate your staff account by creating a secure password.</p>
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();

            if (!token || !email) {
              setError("Missing token or email");
              return;
            }

            setLoading(true);
            setError(undefined);

            try {
              const response = await fetch("/api/auth/set-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  token,
                  email,
                  password,
                  confirmPassword,
                }),
              });

              if (!response.ok) {
                const json = (await response.json()) as { error?: string };
                setError(json.error ?? "Failed to set password");
                return;
              }

              window.location.href = "/login";
            } finally {
              setLoading(false);
            }
          }}
        >
          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordStrengthMeter />
          <Input
            label="Confirm Password"
            type="password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          {error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500">{error}</div>
          ) : null}
          <Button className="h-11 w-full text-base font-semibold" type="submit" loading={loading}>
            Set Password
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function SetPasswordPage(): JSX.Element {
  return (
    <Suspense fallback={<div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm text-[var(--color-text-muted)]">Loading setup...</div>}>
      <SetPasswordContent />
    </Suspense>
  );
}
