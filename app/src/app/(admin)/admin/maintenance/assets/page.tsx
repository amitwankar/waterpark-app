"use client";

import { useEffect, useState, useTransition } from "react";
import { PlusCircle } from "lucide-react";

import { AssetDrawer } from "@/components/maintenance/AssetDrawer";
import { AssetTable, type AssetListItem } from "@/components/maintenance/AssetTable";
import { MaintenanceSummaryBar } from "@/components/maintenance/MaintenanceSummaryBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";

interface AssetsResponse {
  items: AssetListItem[];
  summary: {
    total: number;
    dueSoon: number;
    overdue: number;
    underMaintenance: number;
  };
}

export default function AdminMaintenanceAssetsPage(): JSX.Element {
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [items, setItems] = useState<AssetListItem[]>([]);
  const [summary, setSummary] = useState<AssetsResponse["summary"]>({
    total: 0,
    dueSoon: 0,
    overdue: 0,
    underMaintenance: 0,
  });

  async function loadAssets(): Promise<void> {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/maintenance/assets", { method: "GET" });
      const payload = (await response.json().catch(() => null)) as AssetsResponse | null;
      if (response.ok && payload) {
        setItems(payload.items ?? []);
        setSummary(payload.summary);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAssets();
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Maintenance Assets"
        subtitle="Track service schedules, health status, and linked work orders."
        actions={[
          {
            key: "scan",
            element: (
              <Button
                variant="outline"
                loading={isPending}
                onClick={() => {
                  startTransition(() => {
                    void fetch("/api/v1/maintenance/check-overdue", { method: "POST" })
                      .then((res) => res.json())
                      .then((payload: { scanned?: number; created?: number; message?: string }) => {
                        if (payload.message) {
                          throw new Error(payload.message);
                        }
                        pushToast({
                          title: "Overdue scan complete",
                          message: `Scanned ${payload.scanned ?? 0}, created ${payload.created ?? 0} work orders`,
                          variant: "info",
                        });
                        loadAssets();
                      })
                      .catch((error: unknown) => {
                        pushToast({
                          title: "Scan failed",
                          message: error instanceof Error ? error.message : "Could not scan assets",
                          variant: "error",
                        });
                      });
                  });
                }}
              >
                Check Overdue
              </Button>
            ),
          },
          {
            key: "add",
            element: (
              <Button onClick={() => setDrawerOpen(true)}>
                <PlusCircle className="h-4 w-4" />
                Add Asset
              </Button>
            ),
          },
        ]}
      />

      <MaintenanceSummaryBar
        total={summary.total}
        dueSoon={summary.dueSoon}
        overdue={summary.overdue}
        underMaintenance={summary.underMaintenance}
      />

      <AssetTable
        items={items}
        loading={loading}
        onService={(assetId) => {
          startTransition(() => {
            void fetch(`/api/v1/maintenance/assets/${assetId}/service`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            })
              .then(async (response) => {
                if (!response.ok) {
                  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
                  throw new Error(payload?.message ?? "Service update failed");
                }
                pushToast({ title: "Service updated", variant: "success" });
                loadAssets();
              })
              .catch((error: unknown) => {
                pushToast({
                  title: "Service update failed",
                  message: error instanceof Error ? error.message : "Could not update service",
                  variant: "error",
                });
              });
          });
        }}
      />

      <AssetDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={() => {
          pushToast({ title: "Asset created", variant: "success" });
          loadAssets();
        }}
      />
    </div>
  );
}
