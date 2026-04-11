"use client";

import { useEffect, useState } from "react";

import { CampaignBuilder, type CampaignBuilderTemplate } from "@/components/campaigns/CampaignBuilder";
import { PageHeader } from "@/components/layout/PageHeader";

interface TemplateResponse {
  items: CampaignBuilderTemplate[];
}

export default function NewCampaignPage(): JSX.Element {
  const [templates, setTemplates] = useState<CampaignBuilderTemplate[]>([]);

  useEffect(() => {
    void fetch("/api/v1/communication/templates", { method: "GET" })
      .then((response) => response.json())
      .then((payload: TemplateResponse) => setTemplates(payload.items ?? []));
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader title="New Campaign" subtitle="Create and schedule a bulk messaging campaign." />
      <CampaignBuilder templates={templates} />
    </div>
  );
}
