"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";

import { CampaignTable, type CampaignTableItem } from "@/components/campaigns/CampaignTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";

interface CampaignListResponse {
  items: CampaignTableItem[];
}

export default function AdminCampaignsPage(): JSX.Element {
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CampaignTableItem[]>([]);
  const [statusTab, setStatusTab] = useState<"ALL" | "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "CANCELLED">("ALL");

  async function loadCampaigns(): Promise<void> {
    setLoading(true);
    try {
      const query = statusTab === "ALL" ? "" : `?status=${statusTab}`;
      const response = await fetch(`/api/v1/campaigns${query}`, { method: "GET" });
      const payload = (await response.json().catch(() => ({ items: [] }))) as CampaignListResponse;
      if (response.ok) {
        setItems(payload.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCampaigns();
  }, [statusTab]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadCampaigns();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [statusTab]);

  const tabs = useMemo(() => ["ALL", "DRAFT", "SCHEDULED", "SENDING", "SENT", "CANCELLED"] as const, []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Campaigns"
        subtitle="Manage bulk communication campaigns and delivery progress."
        actions={[
          {
            key: "new",
            element: (
              <Link href="/admin/campaigns/new">
                <Button>New Campaign</Button>
              </Link>
            ),
          },
          {
            key: "templates",
            element: (
              <Link href="/admin/campaigns/templates">
                <Button variant="outline">Templates</Button>
              </Link>
            ),
          },
          {
            key: "logs",
            element: (
              <Link href="/admin/campaigns/log">
                <Button variant="ghost">Logs</Button>
              </Link>
            ),
          },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab}
            size="sm"
            variant={statusTab === tab ? "primary" : "outline"}
            onClick={() => setStatusTab(tab)}
          >
            {tab}
          </Button>
        ))}
      </div>

      <CampaignTable
        items={items}
        loading={loading}
        onSend={(campaignId) => {
          startTransition(() => {
            void fetch(`/api/v1/campaigns/${campaignId}/send`, { method: "POST" })
              .then(async (response) => {
                if (!response.ok) {
                  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
                  throw new Error(payload?.message ?? "Send failed");
                }
                pushToast({ title: "Campaign sending started", variant: "success" });
                loadCampaigns();
              })
              .catch((error: unknown) => {
                pushToast({
                  title: "Send failed",
                  message: error instanceof Error ? error.message : "Could not send campaign",
                  variant: "error",
                });
              });
          });
        }}
        onCancel={(campaignId) => {
          startTransition(() => {
            void fetch(`/api/v1/campaigns/${campaignId}/cancel`, { method: "POST" })
              .then(async (response) => {
                if (!response.ok) {
                  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
                  throw new Error(payload?.message ?? "Cancel failed");
                }
                pushToast({ title: "Campaign cancelled", variant: "info" });
                loadCampaigns();
              })
              .catch((error: unknown) => {
                pushToast({
                  title: "Cancel failed",
                  message: error instanceof Error ? error.message : "Could not cancel campaign",
                  variant: "error",
                });
              });
          });
        }}
      />

      {isPending ? <p className="text-xs text-[var(--color-text-muted)]">Processing...</p> : null}
    </div>
  );
}
