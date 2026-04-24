import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireStaff } from "@/lib/session";

function mapTerminalToPosPath(terminalId: string): string {
  const terminal = terminalId.toUpperCase();
  if (terminal.includes("FOOD")) return "/staff/pos/food";
  if (terminal.includes("LOCKER")) return "/staff/pos/locker";
  if (terminal.includes("COSTUME")) return "/staff/pos/costume";
  if (terminal.includes("PARKING")) return "/staff/pos/parking";
  return "/staff/pos/ticket";
}

/** GET /api/v1/pos/sessions/active-staff — active session for current staff/admin user */
export async function GET() {
  const { user, error } = await requireStaff();
  if (error) return error;

  const session = await db.posSession.findFirst({
    where: {
      staffId: user.id,
      status: "OPEN",
    },
    orderBy: { openedAt: "desc" },
    select: {
      id: true,
      terminalId: true,
      openedAt: true,
      status: true,
    },
  });

  if (!session) {
    return NextResponse.json({ session: null });
  }

  const redirectTo = `${mapTerminalToPosPath(session.terminalId)}?terminalId=${encodeURIComponent(session.terminalId)}`;
  return NextResponse.json({
    session: {
      ...session,
      redirectTo,
    },
  });
}
