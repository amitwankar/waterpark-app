"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";

import { PageHeader } from "@/components/layout/PageHeader";
import { PriorityBadge } from "@/components/maintenance/PriorityBadge";
import { WorkOrderComments } from "@/components/maintenance/WorkOrderComments";
import { WorkOrderDetail } from "@/components/maintenance/WorkOrderDetail";
import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

interface WorkOrderResponse {
  workOrder: {
    id: string;
    workOrderNumber: string;
    title: string;
    description: string | null;
    priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    dueDate: string | null;
    createdAt: string;
    completedAt: string | null;
    resolutionNotes: string | null;
    asset: { id: string; name: string; assetType: string; location: string | null };
    ride?: { id: string; name: string; status: string } | null;
    comments: Array<{ timestamp: string; name: string; text: string }>;
  };
}

export default function AdminWorkOrderDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = String(params.id ?? "");
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [workOrder, setWorkOrder] = useState<WorkOrderResponse["workOrder"] | null>(null);
  const [completeNotes, setCompleteNotes] = useState("");
  const [completeCost, setCompleteCost] = useState("");

  async function loadWorkOrder(): Promise<void> {
    if (!id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/maintenance/work-orders/${id}`, { method: "GET" });
      const payload = (await response.json().catch(() => null)) as WorkOrderResponse | null;
      if (response.ok && payload?.workOrder) {
        setWorkOrder(payload.workOrder);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkOrder();
  }, [id]);

  return (
    <div className="space-y-5">
      <PageHeader title={workOrder?.workOrderNumber ?? "Work Order"} subtitle={workOrder?.title} />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {workOrder ? <WorkOrderDetail workOrder={workOrder} /> : null}

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--color-text)]">Actions</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {workOrder ? <PriorityBadge priority={workOrder.priority} /> : null}
              </div>

              {workOrder?.status === "OPEN" ? (
                <Button
                  className="w-full"
                  loading={isPending}
                  onClick={() => {
                    startTransition(() => {
                      void fetch(`/api/v1/maintenance/work-orders/${id}/accept`, { method: "POST" })
                        .then(() => loadWorkOrder())
                        .catch(() => pushToast({ title: "Accept failed", variant: "error" }));
                    });
                  }}
                >
                  Accept (In Progress)
                </Button>
              ) : null}

              {workOrder && ["OPEN", "IN_PROGRESS"].includes(workOrder.status) ? (
                <>
                  <textarea
                    value={completeNotes}
                    onChange={(event) => setCompleteNotes(event.target.value)}
                    className="h-24 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm outline-none"
                    placeholder="Resolution notes"
                  />
                  <input
                    type="number"
                    min={0}
                    value={completeCost}
                    onChange={(event) => setCompleteCost(event.target.value)}
                    className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm"
                    placeholder="Actual cost"
                  />
                  <Button
                    className="w-full"
                    loading={isPending}
                    onClick={() => {
                      if (!completeNotes.trim()) return;
                      startTransition(() => {
                        void fetch(`/api/v1/maintenance/work-orders/${id}/complete`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            resolutionNotes: completeNotes,
                            actualCost: completeCost ? Number(completeCost) : undefined,
                          }),
                        })
                          .then(() => {
                            setCompleteNotes("");
                            setCompleteCost("");
                            loadWorkOrder();
                          })
                          .catch(() => pushToast({ title: "Complete failed", variant: "error" }));
                      });
                    }}
                  >
                    Mark Completed
                  </Button>
                </>
              ) : null}

              {workOrder?.status === "COMPLETED" ? (
                <Button
                  variant="outline"
                  className="w-full"
                  loading={isPending}
                  onClick={() => {
                    startTransition(() => {
                      void fetch(`/api/v1/maintenance/work-orders/${id}/reopen`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ reason: "Issue recurred" }),
                      })
                        .then(() => loadWorkOrder())
                        .catch(() => pushToast({ title: "Reopen failed", variant: "error" }));
                    });
                  }}
                >
                  Reopen Work Order
                </Button>
              ) : null}

              {workOrder?.ride && workOrder.status === "COMPLETED" ? (
                <Button
                  variant="secondary"
                  className="w-full"
                  loading={isPending}
                  onClick={() => {
                    startTransition(() => {
                      void fetch(`/api/v1/rides/${workOrder.ride?.id}/status`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "ACTIVE", reason: "Maintenance completed" }),
                      })
                        .then(() => {
                          pushToast({ title: "Ride reactivated", variant: "success" });
                          router.refresh();
                        })
                        .catch(() => pushToast({ title: "Reactivate failed", variant: "error" }));
                    });
                  }}
                >
                  Reactivate Ride
                </Button>
              ) : null}
            </CardBody>
          </Card>

          {workOrder ? (
            <WorkOrderComments
              workOrderId={workOrder.id}
              comments={workOrder.comments}
              onPosted={() => void loadWorkOrder()}
            />
          ) : null}
        </div>
      </div>

      {loading && !workOrder ? <p className="text-sm text-[var(--color-text-muted)]">Loading work order...</p> : null}
    </div>
  );
}
