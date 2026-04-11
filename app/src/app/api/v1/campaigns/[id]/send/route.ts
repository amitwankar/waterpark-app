import { NextRequest, NextResponse } from "next/server";

import {
  enqueueCampaignJobs,
  ensureCampaignWorkerStarted,
  getCampaign,
  resolveSegmentRecipients,
  setCampaignRecipients,
  updateCampaign,
} from "@/lib/queue";
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

  if (campaign.status === "SENDING") {
    return NextResponse.json({ message: "Campaign already sending" }, { status: 400 });
  }

  const recipients = await resolveSegmentRecipients(campaign.segmentType, campaign.segmentFilters);

  await setCampaignRecipients(campaign.id, recipients);

  await updateCampaign(campaign.id, {
    status: "SENDING",
    targetCount: recipients.length,
    sentCount: 0,
    deliveredCount: 0,
    failedCount: 0,
  });

  ensureCampaignWorkerStarted();
  const enqueued = await enqueueCampaignJobs(campaign.id, recipients);

  if (enqueued === 0) {
    await updateCampaign(campaign.id, { status: "SENT" });
  }

  return NextResponse.json({
    campaignId: campaign.id,
    targetCount: recipients.length,
    enqueued,
  });
}
