"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { WorkOrderDrawer } from "@/components/maintenance/WorkOrderDrawer";
import { WorkOrderTable, type WorkOrderListItem } from "@/components/maintenance/WorkOrderTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

interface WorkOrdersResponse {
  items: WorkOrderListItem[];
}

interface AssetsResponse {
  items: Array<{ id: string; name: string; assetType: string }>;
}

export default function AdminWorkOrdersPage(): JSX.Element {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [items, setItems] = useState<WorkOrderListItem[]>([]);
  const [assets, setAssets] = useState<Array<{ id: string; name: string; assetType: string }>>([]);
  const [techs, setTechs] = useState<Array<{ id: string; name: string }>>([]);

  const [priority, setPriority] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [assignedTo, setAssignedTo] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [search, setSearch] = useState("");

  async function loadData(): Promise<void> {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        priority,
        status,
      });
      if (assignedTo) query.set("assignedTo", assignedTo);
      if (overdue) query.set("overdue", "1");
      if (search.trim()) query.set("search", search.trim());

      const [woResponse, assetResponse, staffResponse] = await Promise.all([
        fetch(`/api/v1/maintenance/work-orders?${query.toString()}`, { method: "GET" }),
        fetch("/api/v1/maintenance/assets", { method: "GET" }),
        fetch("/api/v1/staff?subRole=MAINTENANCE_TECH", { method: "GET" }),
      ]);

      const woPayload = (await woResponse.json().catch(() => ({ items: [] }))) as WorkOrdersResponse;
      const assetPayload = (await assetResponse.json().catch(() => ({ items: [] }))) as AssetsResponse;
      const staffPayload = (await staffResponse.json().catch(() => [])) as Array<{ id: string; name: string }>;

      if (woResponse.ok) setItems(woPayload.items ?? []);
      if (assetResponse.ok) setAssets(assetPayload.items ?? []);
      if (staffResponse.ok) setTechs(staffPayload ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [priority, status, assignedTo, overdue]);

  const priorityTabs = useMemo(() => ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"], []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Work Orders"
        subtitle="Track all maintenance work orders with priority and SLA controls."
        actions={[
          {
            key: "create",
            element: (
              <Button onClick={() => setDrawerOpen(true)}>
                <Plus className="h-4 w-4" />
                Create Work Order
              </Button>
            ),
          },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        {priorityTabs.map((tab) => (
          <Button key={tab} size="sm" variant={priority === tab ? "primary" : "outline"} onClick={() => setPriority(tab)}>
            {tab}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-4">
        <Select
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={[
            { label: "ALL", value: "ALL" },
            { label: "OPEN", value: "OPEN" },
            { label: "IN_PROGRESS", value: "IN_PROGRESS" },
            { label: "COMPLETED", value: "COMPLETED" },
            { label: "CANCELLED", value: "CANCELLED" },
          ]}
        />

        <Select
          label="Assigned To"
          value={assignedTo}
          onChange={(event) => setAssignedTo(event.target.value)}
          placeholder="All"
          options={techs.map((tech) => ({ label: tech.name, value: tech.id }))}
        />

        <Input label="Search" value={search} onChange={(event) => setSearch(event.target.value)} />

        <div className="flex items-end gap-2">
          <Button variant={overdue ? "danger" : "outline"} className="w-full" onClick={() => setOverdue((state) => !state)}>
            {overdue ? "Overdue Only" : "Show Overdue"}
          </Button>
          <Button variant="ghost" onClick={() => void loadData()}>Apply</Button>
        </div>
      </div>

      <WorkOrderTable items={items} loading={loading} />

      <WorkOrderDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        assets={assets}
        techs={techs}
        onCreated={() => void loadData()}
      />
    </div>
  );
}
