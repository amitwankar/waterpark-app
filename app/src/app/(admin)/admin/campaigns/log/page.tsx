"use client";

import { useEffect, useState } from "react";

import { CommunicationLogTable, type CommunicationLogItem } from "@/components/campaigns/CommunicationLogTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

interface LogResponse {
  items: CommunicationLogItem[];
}

export default function CampaignLogPage(): JSX.Element {
  const [items, setItems] = useState<CommunicationLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  async function loadLogs(): Promise<void> {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (channel) query.set("channel", channel);
      if (status) query.set("status", status);
      if (search.trim()) query.set("search", search.trim());

      const response = await fetch(`/api/v1/communication/log?${query.toString()}`, { method: "GET" });
      const payload = (await response.json().catch(() => ({ items: [] }))) as LogResponse;
      if (response.ok) {
        setItems(payload.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, [channel, status]);

  return (
    <div className="space-y-5">
      <PageHeader title="Outgoing Log" subtitle="All outbound messages across channels." />

      <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-4">
        <Select
          label="Channel"
          value={channel}
          onChange={(event) => setChannel(event.target.value)}
          placeholder="All"
          options={[
            { label: "SMS", value: "SMS" },
            { label: "WhatsApp", value: "WHATSAPP" },
            { label: "Email", value: "EMAIL" },
          ]}
        />

        <Select
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          placeholder="All"
          options={[
            { label: "QUEUED", value: "QUEUED" },
            { label: "SENT", value: "SENT" },
            { label: "FAILED", value: "FAILED" },
          ]}
        />

        <Input label="Search" value={search} onChange={(event) => setSearch(event.target.value)} />

        <div className="flex items-end">
          <button
            type="button"
            className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm"
            onClick={() => void loadLogs()}
          >
            Apply
          </button>
        </div>
      </div>

      <CommunicationLogTable items={items} loading={loading} />
    </div>
  );
}
