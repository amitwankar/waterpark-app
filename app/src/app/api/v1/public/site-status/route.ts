import { NextResponse } from "next/server";

import { getCachedSettings } from "@/lib/settings";

export async function GET(): Promise<NextResponse> {
  const settings = await getCachedSettings();
  return NextResponse.json({
    websiteEnabled: settings.websiteEnabled !== false,
  });
}
