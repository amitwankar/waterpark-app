"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export interface LeadDrawerProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  assignees: Array<{ id: string; name: string }>;
}

const typeOptions = [
  { label: "Individual", value: "INDIVIDUAL" },
  { label: "Corporate", value: "CORPORATE" },
  { label: "School", value: "SCHOOL" },
  { label: "Wedding", value: "WEDDING" },
  { label: "Birthday Party", value: "BIRTHDAY_PARTY" },
  { label: "Tour Group", value: "TOUR_GROUP" },
];

const sourceOptions = [
  { label: "Website", value: "WEBSITE" },
  { label: "WhatsApp", value: "WHATSAPP" },
  { label: "Phone", value: "PHONE" },
  { label: "Walk-in", value: "WALKIN" },
  { label: "Social", value: "SOCIAL" },
  { label: "Referral", value: "REFERRAL" },
  { label: "Event", value: "EVENT" },
];

export function LeadDrawer({ open, onClose, onCreated, assignees }: LeadDrawerProps): JSX.Element {
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [type, setType] = useState("INDIVIDUAL");
  const [source, setSource] = useState("WEBSITE");
  const [groupSize, setGroupSize] = useState("");
  const [expectedVisit, setExpectedVisit] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");

  function clearForm(): void {
    setName("");
    setMobile("");
    setType("INDIVIDUAL");
    setSource("WEBSITE");
    setGroupSize("");
    setExpectedVisit("");
    setBudget("");
    setNotes("");
    setAssignedTo("");
    setFollowUpAt("");
  }

  return (
    <Drawer open={open} onClose={onClose} title="Add Lead" widthClassName="w-full max-w-xl">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(() => {
            void fetch("/api/v1/crm/leads", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name,
                mobile,
                type,
                source,
                groupSize: groupSize ? Number(groupSize) : null,
                expectedVisit: expectedVisit || null,
                budget: budget ? Number(budget) : null,
                notes,
                assignedTo: assignedTo || null,
                followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
              }),
            }).then(() => {
              clearForm();
              onClose();
              onCreated?.();
            });
          });
        }}
      >
        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
        <Input label="Mobile" value={mobile} onChange={(event) => setMobile(event.target.value)} required />
        <Select label="Lead Type" value={type} onChange={(event) => setType(event.target.value)} options={typeOptions} />
        <Select label="Source" value={source} onChange={(event) => setSource(event.target.value)} options={sourceOptions} />
        <Input label="Group Size" value={groupSize} onChange={(event) => setGroupSize(event.target.value)} type="number" min={1} />
        <Input label="Expected Visit" value={expectedVisit} onChange={(event) => setExpectedVisit(event.target.value)} type="date" />
        <Input label="Budget" value={budget} onChange={(event) => setBudget(event.target.value)} type="number" min={0} />

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--color-text)]">Notes</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="h-24 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-sm"
          />
        </div>

        <Select
          label="Assign To"
          value={assignedTo}
          onChange={(event) => setAssignedTo(event.target.value)}
          options={assignees.map((item) => ({ label: item.name, value: item.id }))}
          placeholder="Unassigned"
        />

        <Input label="Follow-up Date & Time" value={followUpAt} onChange={(event) => setFollowUpAt(event.target.value)} type="datetime-local" />

        <Button type="submit" loading={isPending} className="w-full">
          Create Lead
        </Button>
      </form>
    </Drawer>
  );
}
