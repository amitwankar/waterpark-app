import { NextRequest, NextResponse } from "next/server";

import { requireSubRole } from "@/lib/session";
import { getActiveSession } from "@/lib/pos";

/** GET /api/v1/pos/sessions/active?terminalId=GATE_1 */
export async function GET(req: NextRequest) {
  const { error } = await requireSubRole(
    "TICKET_COUNTER", "FB_STAFF", "LOCKER_ATTENDANT", "COSTUME_ATTENDANT", "PARKING_ATTENDANT", "SALES_EXECUTIVE"
  );
  if (error) return error;

  const terminalId = new URL(req.url).searchParams.get("terminalId");
  if (!terminalId) {
    return NextResponse.json({ error: "terminalId is required" }, { status: 400 });
  }

  const session = await getActiveSession(terminalId);

  if (!session) {
    return NextResponse.json({ session: null });
  }

  return NextResponse.json({ session });
}
