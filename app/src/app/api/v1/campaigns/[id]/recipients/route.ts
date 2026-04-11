import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCampaign, getCampaignRecipients } from "@/lib/queue";
import { getSessionUser, requireAdmin } from "@/lib/rides";

export async function GET(
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

  const recipients = await getCampaignRecipients(campaign.id);
  if (recipients.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const logs = await db.communicationLog.findMany({
    where: {
      referenceType: "campaign",
      referenceId: campaign.id,
    },
    orderBy: { createdAt: "desc" },
  });

  const map = new Map<string, { status: string; sentAt: Date | null; errorMessage: string | null }>();
  for (const log of logs) {
    const mobile = log.recipientMobile ?? "";
    const email = log.recipientEmail ?? "";
    const key = mobile || email;
    if (!key || map.has(key)) continue;
    map.set(key, {
      status: log.status,
      sentAt: log.sentAt,
      errorMessage: log.errorMessage,
    });
  }

  return NextResponse.json({
    items: recipients.map((recipient) => {
      const key = recipient.mobile || recipient.email || "";
      const log = map.get(key);
      return {
        ...recipient,
        deliveryStatus: log?.status ?? "QUEUED",
        sentAt: log?.sentAt ?? null,
        errorMessage: log?.errorMessage ?? null,
      };
    }),
  });
}
