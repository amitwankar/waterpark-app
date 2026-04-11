"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export interface WorkOrderDrawerProps {
  open: boolean;
  onClose: () => void;
  assets: Array<{ id: string; name: string; assetType: string }>;
  techs: Array<{ id: string; name: string }>;
  onCreated?: () => void;
}

function dueDateByPriority(priority: string): string {
  const now = new Date();
  const days = priority === "CRITICAL" ? 0 : priority === "HIGH" ? 1 : priority === "MEDIUM" ? 3 : 7;
  const due = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return due.toISOString().slice(0, 10);
}

export function WorkOrderDrawer({ open, onClose, assets, techs, onCreated }: WorkOrderDrawerProps): JSX.Element {
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [assetId, setAssetId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState(dueDateByPriority("MEDIUM"));
  const [estimatedCost, setEstimatedCost] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((asset) => `${asset.name} ${asset.assetType}`.toLowerCase().includes(q));
  }, [assets, search]);

  function reset(): void {
    setSearch("");
    setAssetId("");
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setAssignedTo("");
    setDueDate(dueDateByPriority("MEDIUM"));
    setEstimatedCost("");
    setAttachments([]);
  }

  return (
    <Drawer open={open} onClose={onClose} title="Create Work Order" widthClassName="w-full max-w-2xl">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!assetId) return;

          startTransition(() => {
            void fetch("/api/v1/maintenance/work-orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                assetId,
                title,
                description,
                priority,
                assignedTo: assignedTo || null,
                dueDate,
                estimatedCost: estimatedCost ? Number(estimatedCost) : undefined,
                attachments: attachments.map((file) => file.name),
              }),
            }).then(() => {
              reset();
              onClose();
              onCreated?.();
            });
          });
        }}
      >
        <Input label="Search Asset" value={search} onChange={(event) => setSearch(event.target.value)} />

        <Select
          label="Asset"
          value={assetId}
          onChange={(event) => setAssetId(event.target.value)}
          options={filteredAssets.map((asset) => ({ label: `${asset.name} (${asset.assetType})`, value: asset.id }))}
          placeholder="Choose asset"
          required
        />

        <Input label="Title" value={title} onChange={(event) => setTitle(event.target.value)} required />

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--color-text)]">Description</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="h-24 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm outline-none"
            required
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Select
            label="Priority"
            value={priority}
            onChange={(event) => {
              setPriority(event.target.value);
              setDueDate(dueDateByPriority(event.target.value));
            }}
            options={[
              { label: "CRITICAL", value: "CRITICAL" },
              { label: "HIGH", value: "HIGH" },
              { label: "MEDIUM", value: "MEDIUM" },
              { label: "LOW", value: "LOW" },
            ]}
          />

          <Select
            label="Assign To"
            value={assignedTo}
            onChange={(event) => setAssignedTo(event.target.value)}
            options={techs.map((tech) => ({ label: tech.name, value: tech.id }))}
            placeholder="Unassigned"
          />

          <Input label="Due Date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <Input
            label="Estimated Cost"
            type="number"
            min={0}
            value={estimatedCost}
            onChange={(event) => setEstimatedCost(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--color-text)]">Attachments (jpg/png/pdf, max 5MB)</label>
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={(event) => {
              const next = Array.from(event.target.files ?? []).filter((file) => file.size <= 5 * 1024 * 1024);
              setAttachments(next.slice(0, 5));
            }}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] p-2 text-sm"
          />
          {attachments.length > 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">{attachments.map((file) => file.name).join(", ")}</p>
          ) : null}
        </div>

        <Button type="submit" loading={isPending} className="w-full">
          Create Work Order
        </Button>
      </form>
    </Drawer>
  );
}
