import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

/** After laundry/inspection, admin marks a RETURNED item as AVAILABLE again. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;

  const item = await db.costumeItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.status !== "RETURNED" && item.status !== "MAINTENANCE")
    return NextResponse.json({ error: `Item is ${item.status}, not RETURNED/MAINTENANCE` }, { status: 409 });

  await db.costumeItem.update({ where: { id }, data: { status: "AVAILABLE" } });
  return NextResponse.json({ ok: true });
}
