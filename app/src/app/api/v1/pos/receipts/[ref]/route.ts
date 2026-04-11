import { NextRequest, NextResponse } from "next/server";

import { requireSubRole } from "@/lib/session";
import { buildBookingReceipt, buildFoodReceipt, buildLockerReceipt } from "@/lib/receipt";

/**
 * GET /api/v1/pos/receipts/[ref]?type=booking|food|locker
 * Returns serializable receipt data for the frontend ReceiptModal.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { error } = await requireSubRole(
    "TICKET_COUNTER", "FB_STAFF", "LOCKER_ATTENDANT", "COSTUME_ATTENDANT", "SALES_EXECUTIVE"
  );
  if (error) return error;

  const { ref } = await params;
  const type = new URL(req.url).searchParams.get("type") ?? "booking";

  let receipt = null;

  if (type === "food") {
    receipt = await buildFoodReceipt(ref);
  } else if (type === "locker") {
    receipt = await buildLockerReceipt(ref);
  } else {
    receipt = await buildBookingReceipt(ref);
  }

  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  return NextResponse.json(receipt);
}
