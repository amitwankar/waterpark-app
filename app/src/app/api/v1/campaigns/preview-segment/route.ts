import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resolveSegmentRecipients, type SegmentType } from "@/lib/queue";
import { getSessionUser, requireAdmin } from "@/lib/rides";

const previewSchema = z.object({
  segmentType: z.enum([
    "ALL_GUESTS",
    "TIER",
    "TAG",
    "INACTIVE",
    "BIRTHDAY_MONTH",
    "ANNIVERSARY_MONTH",
    "LEAD_STAGE",
    "LEAD_SOURCE",
    "HIGH_SPENDERS",
    "CUSTOM_MOBILE_LIST",
  ]),
  segmentFilters: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdmin(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = previewSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const recipients = await resolveSegmentRecipients(
    parsed.data.segmentType as SegmentType,
    parsed.data.segmentFilters,
  );

  return NextResponse.json({
    count: recipients.length,
    samples: recipients.slice(0, 5).map((recipient) => ({
      id: recipient.id,
      name: recipient.name,
      mobile: recipient.mobile,
      email: recipient.email,
    })),
  });
}
