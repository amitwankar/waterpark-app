import type { ReactNode } from "react";
import { Suspense } from "react";

import { WebsiteFooter } from "@/components/website/WebsiteFooter";
import { WebsiteHeader } from "@/components/website/WebsiteHeader";
import { getCachedSettings } from "@/lib/settings";

interface WebsiteLayoutProps {
  children: ReactNode;
}

async function WebsiteFooterSlot(): Promise<JSX.Element> {
  const settings = await getCachedSettings();
  return <WebsiteFooter parkName={settings.parkName} />;
}

export default function WebsiteLayout({ children }: WebsiteLayoutProps): JSX.Element {
  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-text)]">
      <WebsiteHeader />
      <Suspense fallback={<main className="min-h-[60vh]" />}>
        <main>{children}</main>
      </Suspense>
      <Suspense fallback={<div className="h-24 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)]" />}>
        <WebsiteFooterSlot />
      </Suspense>
    </div>
  );
}
