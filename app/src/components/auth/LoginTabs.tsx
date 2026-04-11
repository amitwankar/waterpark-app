"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { MagicLinkForm } from "@/components/auth/MagicLinkForm";
import { WhatsAppOtpForm } from "@/components/auth/WhatsAppOtpForm";
import { EmailPasswordForm } from "@/components/auth/EmailPasswordForm";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { cn } from "@/lib/utils";

const tabs = ["email", "whatsapp", "magic"] as const;

type Tab = (typeof tabs)[number];

interface LoginTabsProps {
  returnUrl?: string;
}

export function LoginTabs({ returnUrl }: LoginTabsProps): JSX.Element {
  const searchParams = useSearchParams();
  const [active, setActive] = useState<Tab>("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    setError(undefined);
    setMessage(undefined);
  }, [active]);

  const callbackUrl = useMemo(() => returnUrl ?? searchParams.get("returnUrl") ?? "/", [returnUrl, searchParams]);

  async function handleEmailLogin(payload: { email: string; password: string; rememberMe: boolean }): Promise<void> {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
          rememberMe: payload.rememberMe,
          callbackURL: callbackUrl,
        }),
      });

      if (!response.ok) {
        setError("Invalid email or password");
        return;
      }

      const sessionResponse = await fetch("/api/auth/get-session", { cache: "no-store" });
      if (sessionResponse.ok) {
        const sessionJson = (await sessionResponse.json()) as { user?: { role?: string } };
        const role = sessionJson?.user?.role;
        if (role === "ADMIN") {
          window.location.href = callbackUrl === "/" ? "/admin/dashboard" : callbackUrl;
          return;
        }
        if (role === "EMPLOYEE") {
          window.location.href = callbackUrl === "/" ? "/staff/pos" : callbackUrl;
          return;
        }
      }

      window.location.href = callbackUrl === "/" ? "/guest/my-account" : callbackUrl;
    } finally {
      setLoading(false);
    }
  }

  async function handleWhatsAppSend(mobile: string): Promise<{ retryAfterSec?: number } | void> {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/auth/whatsapp-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const json = (await response.json()) as { retryAfterSec?: number; error?: string };

      if (!response.ok) {
        setError(json.error ?? "Failed to send OTP");
      } else {
        setMessage("OTP sent to WhatsApp");
      }

      return { retryAfterSec: json.retryAfterSec };
    } finally {
      setLoading(false);
    }
  }

  async function handleWhatsAppVerify(mobile: string, otp: string): Promise<void> {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/auth/whatsapp-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, otp, returnUrl: callbackUrl }),
      });

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        setError(json.error ?? "OTP verification failed");
        return;
      }

      window.location.href = callbackUrl;
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(email: string): Promise<void> {
    setLoading(true);
    setError(undefined);
    setMessage(undefined);

    try {
      const response = await fetch("/api/auth/magic-link/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, callbackURL: callbackUrl }),
      });

      if (!response.ok) {
        setError("Could not send magic link");
        return;
      }

      setMessage("Check your email for your login link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <GoogleLoginButton callbackURL={callbackUrl} />

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-1">
        <div className="grid grid-cols-3 gap-1">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab}
              onClick={() => setActive(tab)}
              className={cn(
                "rounded-lg px-3 py-2.5 text-sm font-semibold transition-all",
                active === tab
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]",
              )}
            >
              {tab === "email" ? "Email" : tab === "whatsapp" ? "WhatsApp OTP" : "Magic Link"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
        {active === "email" ? <EmailPasswordForm onSubmit={handleEmailLogin} loading={loading} error={error} /> : null}
        {active === "whatsapp" ? (
          <WhatsAppOtpForm onSend={handleWhatsAppSend} onVerify={handleWhatsAppVerify} loading={loading} error={error} />
        ) : null}
        {active === "magic" ? <MagicLinkForm onSubmit={handleMagicLink} loading={loading} message={message} error={error} /> : null}
      </div>
    </div>
  );
}
