"use client";

import { Button } from "@/components/ui/Button";

interface GoogleLoginButtonProps {
  callbackURL?: string;
}

export function GoogleLoginButton({ callbackURL }: GoogleLoginButtonProps): JSX.Element {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-card)] hover:border-teal-500/60 hover:bg-[var(--color-surface-muted)]"
      onClick={() => {
        const url = new URL("/api/auth/sign-in/social", window.location.origin);
        url.searchParams.set("provider", "google");
        if (callbackURL) {
          url.searchParams.set("callbackURL", callbackURL);
        }
        window.location.href = url.toString();
      }}
    >
      Continue with Google
    </Button>
  );
}
