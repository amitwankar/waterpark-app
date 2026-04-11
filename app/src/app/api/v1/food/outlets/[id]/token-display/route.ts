import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";

import { redis } from "@/lib/redis";
import { requireStaff } from "@/lib/session";

const TOKEN_KEY = (outletId: string, date: string) =>
  `food:token:${outletId}:${date}`;

/**
 * GET /api/v1/food/outlets/[id]/token-display
 * Returns the current token counter for this outlet today.
 * Used by the kitchen display to know which tokens have been issued.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { id } = await params;
  const today = format(new Date(), "yyyy-MM-dd");
  const key = TOKEN_KEY(id, today);

  const raw = await redis.get(key);
  const current = raw ? parseInt(raw, 10) : 0;

  return NextResponse.json({
    outletId: id,
    date: today,
    currentToken: current,
    displayToken: String(current).padStart(3, "0"),
  });
}
