"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface ForgotPasswordFormProps {
  onSubmit: (email: string) => Promise<void>;
  loading?: boolean;
  message?: string;
  error?: string;
}

export function ForgotPasswordForm({ onSubmit, loading, message, error }: ForgotPasswordFormProps): JSX.Element {
  const [email, setEmail] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit(email.toLowerCase().trim());
      }}
    >
      <Input type="email" label="Email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      {message ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-600">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500">{error}</div>
      ) : null}
      <Button className="h-11 w-full text-base font-semibold" type="submit" loading={loading}>
        Send reset link
      </Button>
    </form>
  );
}
