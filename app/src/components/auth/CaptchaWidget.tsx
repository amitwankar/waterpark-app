"use client";

import { useEffect, useMemo, useState } from "react";

interface CaptchaWidgetProps {
  provider?: "hcaptcha" | "recaptcha" | "none";
  enabled?: boolean;
  onVerify?: (token: string) => void;
}

export function CaptchaWidget({ provider, enabled = false, onVerify }: CaptchaWidgetProps): JSX.Element | null {
  const [token, setToken] = useState("");

  const finalProvider = useMemo(() => {
    if (!enabled) return "none";
    return provider ?? (process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ? "hcaptcha" : "recaptcha");
  }, [enabled, provider]);

  useEffect(() => {
    if (token && onVerify) {
      onVerify(token);
    }
  }, [token, onVerify]);

  if (finalProvider === "none") return null;

  return (
    <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
      <p className="text-xs text-[var(--color-text-muted)]">
        {finalProvider === "hcaptcha" ? "hCaptcha enabled" : "reCAPTCHA v3 enabled"}
      </p>
      <input
        value={token}
        onChange={(event) => setToken(event.target.value)}
        placeholder="Paste captcha token"
        className="h-9 w-full rounded-md border border-[var(--color-border)] px-2 text-sm outline-none"
      />
    </div>
  );
}
