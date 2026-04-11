import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCampaign, updateCampaign } from "@/lib/queue";
import { getSessionUser, requireAdmin } from "@/lib/rides";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  channel: z.enum(["SMS", "WHATSAPP", "EMAIL"]).optional(),
  templateId: z.string().cuid().optional(),
  segmentType: z
    .enum([
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
    ])
    .optional(),
  segmentFilters: z.record(z.string(), z.unknown()).optional(),
  scheduledAt: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "SCHEDULED", "SENDING", "SENT", "CANCELLED"]).optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const { id } = await Promise.resolve(context.params);
  const campaign = await getCampaign(id);

  if (!campaign) {
    return NextResponse.json({ message: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ campaign });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdmin(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);
  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await updateCampaign(id, parsed.data);
  if (!updated) {
    return NextResponse.json({ message: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ campaign: updated });
}
