"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { CampaignProgress } from "@/components/campaigns/CampaignProgress";
import { RecipientTable, type RecipientTableItem } from "@/components/campaigns/RecipientTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

interface CampaignResponse {
  campaign: {
    id: string;
    name: string;
    channel: "SMS" | "WHATSAPP" | "EMAIL";
    status: "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "CANCELLED";
    targetCount: number;
    sentCount: number;
    deliveredCount: number;
    failedCount: number;
    segmentType: string;
    segmentFilters: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  };
}

interface RecipientsResponse {
  items: RecipientTableItem[];
}

export default function CampaignDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = String(params.id ?? "");

  const [tab, setTab] = useState<"RECIPIENTS" | "TIMELINE" | "PREVIEW">("RECIPIENTS");
  const [campaign, setCampaign] = useState<CampaignResponse["campaign"] | null>(null);
  const [recipients, setRecipients] = useState<RecipientTableItem[]>([]);

  async function loadCampaign(): Promise<void> {
    const [campaignResponse, recipientsResponse] = await Promise.all([
      fetch(`/api/v1/campaigns/${id}`, { method: "GET" }),
      fetch(`/api/v1/campaigns/${id}/recipients`, { method: "GET" }),
    ]);

    const campaignPayload = (await campaignResponse.json().catch(() => null)) as CampaignResponse | null;
    const recipientsPayload = (await recipientsResponse.json().catch(() => ({ items: [] }))) as RecipientsResponse;

    if (campaignResponse.ok && campaignPayload?.campaign) {
      setCampaign(campaignPayload.campaign);
    }
    if (recipientsResponse.ok) {
      setRecipients(recipientsPayload.items ?? []);
    }
  }

  useEffect(() => {
    if (!id) return;
    void loadCampaign();
  }, [id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (campaign?.status === "SENDING") {
        void loadCampaign();
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [campaign?.status]);

  const deliveryRate = useMemo(() => {
    if (!campaign || campaign.targetCount === 0) return 0;
    return Math.round((campaign.deliveredCount / campaign.targetCount) * 100);
  }, [campaign]);

  return (
    <div className="space-y-5">
      <PageHeader title={campaign?.name ?? "Campaign Detail"} subtitle={`Status: ${campaign?.status ?? "-"}`} />

      {campaign ? (
        <Card>
          <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Target</p>
              <p className="text-xl font-semibold text-[var(--color-text)]">{campaign.targetCount}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Sent</p>
              <p className="text-xl font-semibold text-[var(--color-text)]">{campaign.sentCount}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Delivered</p>
              <p className="text-xl font-semibold text-[var(--color-text)]">{campaign.deliveredCount}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Failed</p>
              <p className="text-xl font-semibold text-[var(--color-text)]">{campaign.failedCount}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Delivery Rate</p>
              <p className="text-xl font-semibold text-[var(--color-text)]">{deliveryRate}%</p>
            </div>
            <div className="sm:col-span-2 xl:col-span-5">
              <CampaignProgress
                targetCount={campaign.targetCount}
                sentCount={campaign.sentCount}
                deliveredCount={campaign.deliveredCount}
                failedCount={campaign.failedCount}
              />
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="flex gap-2">
        <button className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm ${tab === "RECIPIENTS" ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)]"}`} onClick={() => setTab("RECIPIENTS")}>Recipients</button>
        <button className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm ${tab === "TIMELINE" ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)]"}`} onClick={() => setTab("TIMELINE")}>Timeline</button>
        <button className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm ${tab === "PREVIEW" ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)]"}`} onClick={() => setTab("PREVIEW")}>Template Preview</button>
      </div>

      {tab === "RECIPIENTS" ? <RecipientTable items={recipients} /> : null}

      {tab === "TIMELINE" && campaign ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-[var(--color-text)]">Timeline</h3>
          </CardHeader>
          <CardBody className="space-y-2 text-sm text-[var(--color-text-muted)]">
            <p>Created: {new Date(campaign.createdAt).toLocaleString("en-IN")}</p>
            <p>Updated: {new Date(campaign.updatedAt).toLocaleString("en-IN")}</p>
            <p>Status: {campaign.status}</p>
          </CardBody>
        </Card>
      ) : null}

      {tab === "PREVIEW" && campaign ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-[var(--color-text)]">Template Preview</h3>
          </CardHeader>
          <CardBody className="space-y-2 text-sm text-[var(--color-text-muted)]">
            <p>Channel: {campaign.channel}</p>
            <p>Segment: {campaign.segmentType}</p>
            <pre className="overflow-x-auto rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] p-3 text-xs">
              {JSON.stringify(campaign.segmentFilters, null, 2)}
            </pre>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
