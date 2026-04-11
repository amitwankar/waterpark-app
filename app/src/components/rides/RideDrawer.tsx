"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";

export interface RideDrawerProps {
  open: boolean;
  onClose: () => void;
  zones: Array<{ id: string; name: string }>;
  ride?: {
    id: string;
    name: string;
    description: string | null;
    zone: { id: string; name: string };
    entryFee: number;
    gstRate: number;
    minHeight: number | null;
    maxWeight: number | null;
    durationMin: number;
    capacity: number;
    status?: "ACTIVE" | "MAINTENANCE" | "CLOSED" | "SEASONAL";
    sortOrder?: number;
    operator?: { id: string; name: string } | null;
    imageUrl: string | null;
    isUnlimitedCapacity?: boolean;
  } | null;
  operators?: Array<{ id: string; name: string }>;
  onSaved?: () => void;
}

const UNLIMITED_CAPACITY_SENTINEL = 999_999;

export function RideDrawer({ open, onClose, zones, ride, operators = [], onSaved }: RideDrawerProps): JSX.Element {
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(ride?.name ?? "");
  const [description, setDescription] = useState(ride?.description ?? "");
  const [zoneId, setZoneId] = useState(ride?.zone.id ?? zones[0]?.id ?? "");
  const [entryFee, setEntryFee] = useState(String(ride?.entryFee ?? 0));
  const [gstRate, setGstRate] = useState(String(ride?.gstRate ?? 18));
  const [minHeight, setMinHeight] = useState(ride?.minHeight ? String(ride.minHeight) : "");
  const [maxWeight, setMaxWeight] = useState(ride?.maxWeight ? String(ride.maxWeight) : "");
  const [durationMin, setDurationMin] = useState(String(ride?.durationMin ?? 5));
  const [capacity, setCapacity] = useState(String(ride?.capacity ?? 20));
  const [status, setStatus] = useState<"ACTIVE" | "MAINTENANCE" | "CLOSED" | "SEASONAL">(
    ride?.status ?? "ACTIVE",
  );
  const [sortOrder, setSortOrder] = useState(String(ride?.sortOrder ?? 0));
  const [operatorId, setOperatorId] = useState(ride?.operator?.id ?? "");
  const [unlimitedCapacity, setUnlimitedCapacity] = useState(Boolean(ride?.isUnlimitedCapacity));
  const [imageUrl, setImageUrl] = useState(ride?.imageUrl ?? "");
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(ride?.id);

  function num(value: string, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  useEffect(() => {
    setName(ride?.name ?? "");
    setDescription(ride?.description ?? "");
    setZoneId(ride?.zone.id ?? zones[0]?.id ?? "");
    setEntryFee(String(ride?.entryFee ?? 0));
    setGstRate(String(ride?.gstRate ?? 18));
    setMinHeight(ride?.minHeight ? String(ride.minHeight) : "");
    setMaxWeight(ride?.maxWeight ? String(ride.maxWeight) : "");
    setDurationMin(String(ride?.durationMin ?? 5));
    setCapacity(String(ride?.capacity ?? 20));
    setStatus(ride?.status ?? "ACTIVE");
    setSortOrder(String(ride?.sortOrder ?? 0));
    setOperatorId(ride?.operator?.id ?? "");
    setUnlimitedCapacity(Boolean(ride?.isUnlimitedCapacity));
    setImageUrl(ride?.imageUrl ?? "");
    setError(null);
  }, [ride, zones]);

  function resetForm(): void {
    setName("");
    setDescription("");
    setZoneId(zones[0]?.id ?? "");
    setEntryFee("0");
    setGstRate("18");
    setMinHeight("");
    setMaxWeight("");
    setDurationMin("5");
    setCapacity("20");
    setStatus("ACTIVE");
    setSortOrder("0");
    setOperatorId("");
    setUnlimitedCapacity(false);
    setImageUrl("");
    setError(null);
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Ride" : "Add Ride"} className="max-w-2xl">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(() => {
            const payload = {
              name,
              description,
              zoneId,
              entryFee: num(entryFee, 0),
              gstRate: num(gstRate, 18),
              minHeight: minHeight ? num(minHeight, 0) : null,
              maxWeight: maxWeight ? num(maxWeight, 0) : null,
              durationMin: num(durationMin, 5),
              capacity: unlimitedCapacity ? UNLIMITED_CAPACITY_SENTINEL : num(capacity, 20),
              status,
              sortOrder: num(sortOrder, 0),
              operatorId: operatorId || null,
              imageUrl: imageUrl || null,
            };

            const url = isEdit ? `/api/v1/rides/${ride?.id}` : "/api/v1/rides";
            const method = isEdit ? "PUT" : "POST";

            void fetch(url, {
              method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
              .then(async (response) => {
                if (!response.ok) {
                  const data = (await response.json().catch(() => null)) as { message?: string } | null;
                  throw new Error(data?.message ?? "Failed to save ride");
                }
                resetForm();
                onSaved?.();
              })
              .catch((caught: unknown) => {
                const message = caught instanceof Error ? caught.message : "Failed to save ride";
                setError(message);
              });
          });
        }}
      >
        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--color-text)]">Description</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="h-24 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 text-sm"
          />
        </div>

        <Select
          label="Zone"
          value={zoneId}
          onChange={(event) => setZoneId(event.target.value)}
          options={zones.map((zone) => ({ label: zone.name, value: zone.id }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Ride Price (₹)"
            type="number"
            min={0}
            value={entryFee}
            onChange={(event) => setEntryFee(event.target.value)}
            required
          />
          <Input
            label="GST Rate (%)"
            type="number"
            min={0}
            max={100}
            value={gstRate}
            onChange={(event) => setGstRate(event.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Min Height (cm)" type="number" value={minHeight} onChange={(event) => setMinHeight(event.target.value)} />
          <Input label="Max Weight (kg)" type="number" value={maxWeight} onChange={(event) => setMaxWeight(event.target.value)} />
          <Input label="Duration (min)" type="number" value={durationMin} onChange={(event) => setDurationMin(event.target.value)} required />
          <Input
            label="Capacity"
            type="number"
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
            required={!unlimitedCapacity}
            disabled={unlimitedCapacity}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value as "ACTIVE" | "MAINTENANCE" | "CLOSED" | "SEASONAL")}
            options={[
              { label: "Active", value: "ACTIVE" },
              { label: "Maintenance", value: "MAINTENANCE" },
              { label: "Closed", value: "CLOSED" },
              { label: "Seasonal", value: "SEASONAL" },
            ]}
          />
          <Input
            label="Sort Order"
            type="number"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </div>
        <Select
          label="Assigned Operator"
          value={operatorId}
          onChange={(event) => setOperatorId(event.target.value)}
          options={[
            { label: "Unassigned", value: "" },
            ...operators.map((operator) => ({ label: operator.name, value: operator.id })),
          ]}
        />
        <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
          <input
            type="checkbox"
            checked={unlimitedCapacity}
            onChange={(event) => setUnlimitedCapacity(event.target.checked)}
          />
          Unlimited capacity
        </label>

        <Input label="Image URL" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" loading={isPending} className="w-full">
          {isEdit ? "Save Ride" : "Create Ride"}
        </Button>
      </form>
    </Modal>
  );
}
