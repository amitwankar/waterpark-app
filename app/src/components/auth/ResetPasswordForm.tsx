"use client";

import { useState } from "react";

import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps): JSX.Element {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(undefined);
        try {
          const response = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password, confirmPassword }),
          });

          if (!response.ok) {
            setError("Could not reset password");
            return;
          }

          window.location.href = "/login";
        } finally {
          setLoading(false);
        }
      }}
    >
      <Input type="password" label="New Password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      <PasswordStrengthMeter />
      <Input
        type="password"
        label="Confirm Password"
        required
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
      />
      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500">{error}</div>
      ) : null}
      <Button className="h-11 w-full text-base font-semibold" type="submit" loading={loading}>
        Reset Password
      </Button>
    </form>
  );
}
