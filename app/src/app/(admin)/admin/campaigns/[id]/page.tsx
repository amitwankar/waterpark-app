"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { CampaignProgress } from "@/components/campaigns/CampaignProgress";
import { RecipientTable, type RecipientTableItem } from "@/components/campaigns/RecipientTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";

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
  const { pushToast } = useToast();
  const params = useParams<{ id: string }>();
  const id = String(params.id ?? "");

  const [tab, setTab] = useState<"RECIPIENTS" | "TIMELINE" | "PREVIEW">("RECIPIENTS");
  const [campaign, setCampaign] = useState<CampaignResponse["campaign"] | null>(null);
  const [recipients, setRecipients] = useState<RecipientTableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadCampaign(): Promise<void> {
    setLoading(true);
    try {
      const [campaignResponse, recipientsResponse] = await Promise.all([
        fetch(`/api/v1/campaigns/${id}`, { method: "GET" }),
        fetch(`/api/v1/campaigns/${id}/recipients`, { method: "GET" }),
      ]);

      const campaignPayload = (await campaignResponse.json().catch(() => null)) as CampaignResponse | { message?: string } | null;
      const recipientsPayload = (await recipientsResponse.json().catch(() => ({ items: [] }))) as RecipientsResponse | { message?: string };

      if (!campaignResponse.ok) {
        throw new Error((campaignPayload as { message?: string } | null)?.message ?? "Could not load campaign");
      }
      if (!recipientsResponse.ok) {
        throw new Error((recipientsPayload as { message?: string } | null)?.message ?? "Could not load recipients");
      }
      if (campaignPayload && "campaign" in campaignPayload && campaignPayload.campaign) {
        setCampaign(campaignPayload.campaign);
      }
      if ("items" in recipientsPayload) {
        setRecipients(recipientsPayload.items ?? []);
      }
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not load campaign";
      setError(message);
      pushToast({ title: "Load failed", message, variant: "error" });
    } finally {
      setLoading(false);
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
      <PageHeader
        title={campaign?.name ?? "Campaign Detail"}
        subtitle={`Status: ${campaign?.status ?? "-"}`}
        actions={[{ key: "refresh", element: <Button variant="outline" onClick={() => void loadCampaign()} disabled={loading}>Refresh</Button> }]}
      />

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

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
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
