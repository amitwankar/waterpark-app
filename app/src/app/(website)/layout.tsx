import type { ReactNode } from "react";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

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

export default async function WebsiteLayout({ children }: WebsiteLayoutProps): Promise<JSX.Element> {
  const settings = await getCachedSettings();
  const reqHeaders = await headers();
  const allowWhenWebsiteDisabled = reqHeaders.get("x-allow-website-disabled") === "1";
  if (settings.websiteEnabled === false && !allowWhenWebsiteDisabled) {
    redirect("/login");
  }

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
