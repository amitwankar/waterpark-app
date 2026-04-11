"use client";

import { useEffect, useMemo, useState } from "react";

import { TemplateDrawer } from "@/components/campaigns/TemplateDrawer";
import { TemplateGrid } from "@/components/campaigns/TemplateGrid";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";

interface TemplateItem {
  id: string;
  name: string;
  channel: "SMS" | "WHATSAPP" | "EMAIL";
  subject: string | null;
  body: string;
  variables: string[];
  isActive: boolean;
  isSystem?: boolean;
}

interface TemplatesResponse {
  items: TemplateItem[];
}

export default function CampaignTemplatesPage(): JSX.Element {
  const { pushToast } = useToast();
  const [tab, setTab] = useState<"SMS" | "WHATSAPP" | "EMAIL">("SMS");
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateItem | null>(null);

  async function loadTemplates(): Promise<void> {
    const response = await fetch(`/api/v1/communication/templates?channel=${tab}`, { method: "GET" });
    const payload = (await response.json().catch(() => ({ items: [] }))) as TemplatesResponse;
    if (response.ok) {
      setItems(payload.items ?? []);
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, [tab]);

  const filtered = useMemo(() => items.filter((item) => item.channel === tab), [items, tab]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Template Manager"
        subtitle="Manage SMS, WhatsApp, and Email templates."
        actions={[
          {
            key: "new",
            element: <Button onClick={() => { setEditing(null); setDrawerOpen(true); }}>New Template</Button>,
          },
        ]}
      />

      <div className="flex gap-2">
        {(["SMS", "WHATSAPP", "EMAIL"] as const).map((channel) => (
          <Button key={channel} size="sm" variant={tab === channel ? "primary" : "outline"} onClick={() => setTab(channel)}>
            {channel}
          </Button>
        ))}
      </div>

      <TemplateGrid
        items={filtered}
        onEdit={(id) => {
          const item = filtered.find((template) => template.id === id) ?? null;
          setEditing(item);
          setDrawerOpen(true);
        }}
        onTest={(id) => {
          const mobile = window.prompt("Enter test mobile (10 digits)") ?? "";
          const email = window.prompt("Enter test email (optional)") ?? "";
          void fetch(`/api/v1/communication/templates/${id}/test`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mobile, email: email || undefined }),
          }).then(async (response) => {
            const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
            if (!response.ok) {
              pushToast({ title: "Test failed", message: payload?.message ?? "Could not send test", variant: "error" });
              return;
            }
            pushToast({ title: "Test sent", variant: "success" });
          });
        }}
        onDelete={(id) => {
          if (!window.confirm("Delete template?")) return;
          void fetch(`/api/v1/communication/templates/${id}`, { method: "DELETE" }).then(async (response) => {
            const payload = (await response.json().catch(() => null)) as { message?: string } | null;
            if (!response.ok) {
              pushToast({ title: "Delete failed", message: payload?.message ?? "Could not delete", variant: "error" });
              return;
            }
            pushToast({ title: "Template deleted", variant: "success" });
            loadTemplates();
          });
        }}
        onToggleActive={(id, next) => {
          void fetch(`/api/v1/communication/templates/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: next }),
          }).then(() => loadTemplates());
        }}
      />

      <TemplateDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        initial={editing}
        onSaved={() => {
          pushToast({ title: "Template saved", variant: "success" });
          loadTemplates();
        }}
      />
    </div>
  );
}
