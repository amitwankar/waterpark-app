import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/session";
import { getCachedSettings, maskConfig } from "@/lib/settings";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const config = await getCachedSettings();
  return NextResponse.json(maskConfig(config as unknown as Record<string, unknown>));
}
