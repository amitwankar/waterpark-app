"use client";

import { useMemo } from "react";

import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface EmailPasswordFormProps {
  onSubmit: (payload: { email: string; password: string; rememberMe: boolean; captchaToken?: string }) => Promise<void>;
  loading?: boolean;
  error?: string;
}

const passwordPattern = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function EmailPasswordForm({ onSubmit, loading, error }: EmailPasswordFormProps): JSX.Element {
  const strength = useMemo(() => {
    return (password: string) => {
      let score = 0;
      if (password.length >= 8) score += 1;
      if (/[A-Z]/.test(password)) score += 1;
      if (/[a-z]/.test(password)) score += 1;
      if (/\d/.test(password)) score += 1;
      if (/[^A-Za-z0-9]/.test(password)) score += 1;
      return score;
    };
  }, []);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const email = String(form.get("email") ?? "").trim().toLowerCase();
        const password = String(form.get("password") ?? "");
        const rememberMe = String(form.get("rememberMe") ?? "") === "on";
        await onSubmit({ email, password, rememberMe });
      }}
    >
      <Input name="email" type="email" label="Email" required placeholder="you@example.com" />
      <div className="space-y-2">
        <Input name="password" type="password" label="Password" required placeholder="Enter password" />
        <PasswordStrengthMeter valueResolver={strength} />
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <input type="checkbox" name="rememberMe" className="h-4 w-4 rounded border-[var(--color-border)]" />
        Remember me for 30 days
      </label>
      <p className="text-xs text-[var(--color-text-muted)]">
        Password must be 8+ chars and include uppercase, lowercase, number, and special character.
      </p>
      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500">{error}</div>
      ) : null}
      <Button type="submit" className="h-11 w-full text-base font-semibold" loading={loading}>
        Sign in with Email
      </Button>
      <p className="text-xs text-[var(--color-text-muted)]">
        Need help?{" "}
        <a className="font-semibold text-[var(--color-primary)] hover:underline" href="/forgot-password">
          Forgot password
        </a>
      </p>
      <input type="hidden" name="_passwordPolicy" value={passwordPattern.source} />
    </form>
  );
}
