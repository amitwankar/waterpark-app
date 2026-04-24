import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { GuestShell } from "@/components/guest/GuestShell";
import { getCachedSettings } from "@/lib/settings";

export default async function GuestLayout({ children }: { children: ReactNode }): Promise<JSX.Element> {
  const settings = await getCachedSettings();
  if (settings.websiteEnabled === false) {
    redirect("/login");
  }

  return <GuestShell>{children}</GuestShell>;
}
