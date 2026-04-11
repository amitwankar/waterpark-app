import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createCampaign, listCampaigns, type CampaignChannel, type SegmentType } from "@/lib/queue";
import { getSessionUser, requireAdmin } from "@/lib/rides";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  channel: z.enum(["SMS", "WHATSAPP", "EMAIL"]),
  templateId: z.string().cuid(),
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
  scheduledAt: z.string().optional().nullable(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const status = request.nextUrl.searchParams.get("status");
  const campaigns = await listCampaigns();

  const filtered = status
    ? campaigns.filter((campaign) => campaign.status === status)
    : campaigns;

  return NextResponse.json({ items: filtered });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdmin(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const campaign = await createCampaign({
    name: parsed.data.name,
    channel: parsed.data.channel as CampaignChannel,
    templateId: parsed.data.templateId,
    segmentType: parsed.data.segmentType as SegmentType,
    segmentFilters: parsed.data.segmentFilters,
    scheduledAt: parsed.data.scheduledAt ?? null,
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
