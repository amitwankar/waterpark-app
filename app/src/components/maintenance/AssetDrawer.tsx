"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const assetTypeOptions = [
  { label: "RIDE", value: "RIDE" },
  { label: "PUMP", value: "PUMP" },
  { label: "ELECTRICAL", value: "ELECTRICAL" },
  { label: "PLUMBING", value: "PLUMBING" },
  { label: "HVAC", value: "HVAC" },
  { label: "VEHICLE", value: "VEHICLE" },
  { label: "SAFETY_EQUIPMENT", value: "SAFETY_EQUIPMENT" },
  { label: "FOOD_EQUIPMENT", value: "FOOD_EQUIPMENT" },
  { label: "LOCKER", value: "LOCKER" },
  { label: "OTHER", value: "OTHER" },
];

export interface AssetDrawerProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function AssetDrawer({ open, onClose, onCreated }: AssetDrawerProps): JSX.Element {
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("RIDE");
  const [location, setLocation] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [lastServiceDate, setLastServiceDate] = useState("");
  const [serviceIntervalDays, setServiceIntervalDays] = useState("30");
  const [linkedRideId, setLinkedRideId] = useState("");
  const [linkedOutletId, setLinkedOutletId] = useState("");
  const [notes, setNotes] = useState("");

  function reset(): void {
    setName("");
    setAssetType("RIDE");
    setLocation("");
    setSerialNumber("");
    setPurchaseDate("");
    setWarrantyExpiry("");
    setLastServiceDate("");
    setServiceIntervalDays("30");
    setLinkedRideId("");
    setLinkedOutletId("");
    setNotes("");
  }

  return (
    <Drawer open={open} onClose={onClose} title="Add Asset" widthClassName="w-full max-w-2xl">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(() => {
            void fetch("/api/v1/maintenance/assets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name,
                assetType,
                location,
                serialNumber: serialNumber || null,
                purchaseDate: purchaseDate || null,
                warrantyExpiry: warrantyExpiry || null,
                lastServiceDate: lastServiceDate || null,
                serviceIntervalDays: Number(serviceIntervalDays || "30"),
                linkedRideId: linkedRideId || null,
                linkedOutletId: linkedOutletId || null,
                notes: notes || null,
              }),
            }).then(() => {
              reset();
              onClose();
              onCreated?.();
            });
          });
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
          <Select
            label="Asset Type"
            value={assetType}
            onChange={(event) => setAssetType(event.target.value)}
            options={assetTypeOptions}
          />
          <Input label="Location" value={location} onChange={(event) => setLocation(event.target.value)} />
          <Input label="Serial No." value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} />
          <Input label="Purchase Date" type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
          <Input label="Warranty Expiry" type="date" value={warrantyExpiry} onChange={(event) => setWarrantyExpiry(event.target.value)} />
          <Input label="Last Service Date" type="date" value={lastServiceDate} onChange={(event) => setLastServiceDate(event.target.value)} />
          <Input
            label="Service Interval (days)"
            type="number"
            min={1}
            value={serviceIntervalDays}
            onChange={(event) => setServiceIntervalDays(event.target.value)}
          />
          <Input label="Link to Ride (optional)" value={linkedRideId} onChange={(event) => setLinkedRideId(event.target.value)} />
          <Input label="Link to Outlet (optional)" value={linkedOutletId} onChange={(event) => setLinkedOutletId(event.target.value)} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--color-text)]">Notes</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="h-24 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm outline-none"
          />
        </div>

        <Button type="submit" loading={isPending} className="w-full">
          Create Asset
        </Button>
      </form>
    </Drawer>
  );
}
