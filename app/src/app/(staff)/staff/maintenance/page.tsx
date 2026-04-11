"use client";

import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { TechWorkOrderCard } from "@/components/maintenance/TechWorkOrderCard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { authClient } from "@/lib/auth-client";

interface WorkOrderItem {
  id: string;
  workOrderNumber: string;
  title: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  dueDate: string | null;
  assignee?: { id: string; name: string } | null;
  asset: { id: string; name: string; assetType: string };
}

interface WorkOrdersResponse {
  items: WorkOrderItem[];
}

export default function StaffMaintenancePage(): JSX.Element {
  const { data: session } = authClient.useSession();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<WorkOrderItem[]>([]);

  async function loadWorkOrders(): Promise<void> {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/maintenance/work-orders?status=ALL&priority=ALL", { method: "GET" });
      const payload = (await response.json().catch(() => ({ items: [] }))) as WorkOrdersResponse;
      if (response.ok) {
        setItems(payload.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkOrders();
  }, []);

  const userId = String(session?.user?.id ?? "");

  const myItems = useMemo(() => {
    const assigned = items.filter((item) => item.assignee?.id === userId);
    return assigned.sort((a, b) => {
      const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return rank[a.priority] - rank[b.priority];
    });
  }, [items, userId]);

  const completedToday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return myItems.filter((item) => item.status === "COMPLETED" && !!item.dueDate);
  }, [myItems]);

  return (
    <div className="space-y-5">
      <PageHeader title="Maintenance Panel" subtitle="My assigned work orders and completion actions." />

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--color-text)]">My Work Orders</h2>
        {loading ? <p className="text-sm text-[var(--color-text-muted)]">Loading...</p> : null}

        {!loading && myItems.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-sm text-[var(--color-text-muted)]">No assigned work orders.</p>
            </CardBody>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {myItems
            .filter((item) => ["OPEN", "IN_PROGRESS"].includes(item.status))
            .map((item) => (
              <TechWorkOrderCard key={item.id} workOrder={item} onChanged={() => void loadWorkOrders()} />
            ))}
        </div>
      </section>

      <section className="space-y-3">
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-[var(--color-text)]">Completed Today</h3>
          </CardHeader>
          <CardBody>
            {completedToday.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No completed work orders today.</p>
            ) : (
              <div className="space-y-2">
                {completedToday.map((item) => (
                  <div key={item.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                    <p className="font-medium text-[var(--color-text)]">{item.workOrderNumber}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">{item.title}</p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
