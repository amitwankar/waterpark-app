"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface MagicLinkFormProps {
  onSubmit: (email: string, captchaToken?: string) => Promise<void>;
  loading?: boolean;
  message?: string;
  error?: string;
}

export function MagicLinkForm({ onSubmit, loading, message, error }: MagicLinkFormProps): JSX.Element {
  const [email, setEmail] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit(email.toLowerCase().trim());
      }}
    >
      <Input
        type="email"
        label="Email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
      />
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <Button type="submit" className="w-full" loading={loading}>
        Send Magic Link
      </Button>
    </form>
  );
}
