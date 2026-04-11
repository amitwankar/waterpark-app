import { NextRequest, NextResponse } from "next/server";

import { cancelCampaignJobs, getCampaign, updateCampaign } from "@/lib/queue";
import { getSessionUser, requireAdmin } from "@/lib/rides";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdmin(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);
  const campaign = await getCampaign(id);

  if (!campaign) {
    return NextResponse.json({ message: "Campaign not found" }, { status: 404 });
  }

  const removedJobs = await cancelCampaignJobs(campaign.id);
  const updated = await updateCampaign(campaign.id, { status: "CANCELLED" });

  return NextResponse.json({
    removedJobs,
    campaign: updated,
  });
}
