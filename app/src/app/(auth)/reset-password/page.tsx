"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

function ResetPasswordContent(): JSX.Element {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  return (
    <div className="space-y-5">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">Reset password</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Choose a new secure password for your account.</p>
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
        {token ? <ResetPasswordForm token={token} /> : <p className="text-sm text-red-500">Invalid token</p>}
      </div>
    </div>
  );
}

export default function ResetPasswordPage(): JSX.Element {
  return (
    <Suspense fallback={<div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm text-[var(--color-text-muted)]">Loading reset form...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
