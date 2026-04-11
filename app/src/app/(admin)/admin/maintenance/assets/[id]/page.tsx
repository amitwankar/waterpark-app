"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useParams } from "next/navigation";

import { AssetDetailCard } from "@/components/maintenance/AssetDetailCard";
import { WorkOrderTable, type WorkOrderListItem } from "@/components/maintenance/WorkOrderTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

interface AssetDetailResponse {
  asset: {
    id: string;
    name: string;
    assetType: string;
    location: string | null;
    serialNumber: string | null;
    purchaseDate: string | null;
    warrantyExpiry: string | null;
    lastServiceDate: string | null;
    nextServiceDate: string | null;
    isActive: boolean;
    workOrders: WorkOrderListItem[];
    serviceHistory: WorkOrderListItem[];
  };
}

export default function AdminAssetDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = String(params.id ?? "");

  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"WORK_ORDERS" | "SERVICE_HISTORY" | "EDIT">("WORK_ORDERS");
  const [asset, setAsset] = useState<AssetDetailResponse["asset"] | null>(null);

  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editSerial, setEditSerial] = useState("");
  const [editWarranty, setEditWarranty] = useState("");

  async function loadAsset(): Promise<void> {
    if (!id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/maintenance/assets/${id}`, { method: "GET" });
      const payload = (await response.json().catch(() => null)) as AssetDetailResponse | null;
      if (response.ok && payload?.asset) {
        setAsset(payload.asset);
        setEditName(payload.asset.name);
        setEditLocation(payload.asset.location ?? "");
        setEditSerial(payload.asset.serialNumber ?? "");
        setEditWarranty(payload.asset.warrantyExpiry ? payload.asset.warrantyExpiry.slice(0, 10) : "");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAsset();
  }, [id]);

  const workOrders = useMemo(() => {
    return (asset?.workOrders ?? []).map((item: any) => ({
      ...item,
      workOrderNumber: item.workOrderNumber ?? `WO-${item.id.slice(-6).toUpperCase()}`,
      isOverdue:
        !!item.dueDate &&
        new Date(item.dueDate).getTime() < Date.now() &&
        ["OPEN", "IN_PROGRESS"].includes(item.status),
    }));
  }, [asset?.workOrders]);

  const serviceHistory = useMemo(() => {
    return (asset?.serviceHistory ?? []).map((item: any) => ({
      ...item,
      workOrderNumber: item.workOrderNumber ?? `WO-${item.id.slice(-6).toUpperCase()}`,
      isOverdue: false,
    }));
  }, [asset?.serviceHistory]);

  return (
    <div className="space-y-5">
      <PageHeader title={asset?.name ?? "Asset Details"} subtitle="Asset profile, service history, and linked work orders." />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {asset ? <AssetDetailCard asset={asset} /> : null}

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={tab === "WORK_ORDERS" ? "primary" : "outline"} onClick={() => setTab("WORK_ORDERS")}>Work Orders</Button>
            <Button size="sm" variant={tab === "SERVICE_HISTORY" ? "primary" : "outline"} onClick={() => setTab("SERVICE_HISTORY")}>Service History</Button>
            <Button size="sm" variant={tab === "EDIT" ? "primary" : "outline"} onClick={() => setTab("EDIT")}>Edit Details</Button>
          </div>

          {tab === "WORK_ORDERS" ? <WorkOrderTable items={workOrders} loading={loading} /> : null}
          {tab === "SERVICE_HISTORY" ? <WorkOrderTable items={serviceHistory} loading={loading} /> : null}

          {tab === "EDIT" ? (
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-[var(--color-text)]">Edit Asset</h3>
              </CardHeader>
              <CardBody className="space-y-3">
                <Input label="Name" value={editName} onChange={(event) => setEditName(event.target.value)} />
                <Input label="Location" value={editLocation} onChange={(event) => setEditLocation(event.target.value)} />
                <Input label="Serial" value={editSerial} onChange={(event) => setEditSerial(event.target.value)} />
                <Input label="Warranty Expiry" type="date" value={editWarranty} onChange={(event) => setEditWarranty(event.target.value)} />
                <Button
                  loading={isPending}
                  onClick={() => {
                    startTransition(() => {
                      void fetch(`/api/v1/maintenance/assets/${id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: editName,
                          location: editLocation || null,
                          serialNumber: editSerial || null,
                          warrantyExpiry: editWarranty || null,
                        }),
                      }).then(() => loadAsset());
                    });
                  }}
                >
                  Save Changes
                </Button>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
