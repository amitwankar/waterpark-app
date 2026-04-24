import { NextResponse } from "next/server";

import { getCachedSettings } from "@/lib/settings";

export async function GET(): Promise<NextResponse> {
  try {
    const settings = await getCachedSettings();
    return NextResponse.json({
      websiteEnabled: settings.websiteEnabled !== false,
    });
  } catch {
    // Fail-open for public health/status checks when DB is temporarily unavailable.
    return NextResponse.json({ websiteEnabled: true });
  }
}
