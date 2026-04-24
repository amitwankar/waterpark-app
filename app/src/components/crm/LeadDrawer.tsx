"use client";

import { useEffect, useState, useTransition } from "react";

import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export type LeadDrawerMode = "create" | "edit";

export interface LeadDrawerProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  onSaved?: () => void;
  assignees: Array<{ id: string; name: string }>;
  mode?: LeadDrawerMode;
  leadId?: string | null;
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

function formatDateForInput(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function formatDateTimeForInput(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  const hh = String(parsed.getHours()).padStart(2, "0");
  const mm = String(parsed.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function LeadDrawer({ open, onClose, onCreated, onSaved, assignees, mode = "create", leadId = null }: LeadDrawerProps): JSX.Element {
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string>("");

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState("INDIVIDUAL");
  const [source, setSource] = useState("WEBSITE");
  const [stage, setStage] = useState("NEW");
  const [groupSize, setGroupSize] = useState("");
  const [expectedVisit, setExpectedVisit] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");

  function clearForm(): void {
    setName("");
    setMobile("");
    setEmail("");
    setType("INDIVIDUAL");
    setSource("WEBSITE");
    setStage("NEW");
    setGroupSize("");
    setExpectedVisit("");
    setBudget("");
    setNotes("");
    setAssignedTo("");
    setFollowUpAt("");
    setFormError("");
  }

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      clearForm();
      return;
    }
    if (!leadId) return;

    let active = true;
    setIsLoading(true);
    setFormError("");
    void fetch(`/api/v1/crm/leads/${leadId}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | {
              message?: string;
              lead?: {
                name: string;
                mobile: string;
                email: string | null;
                source: string;
                stage: string;
                type: string | null;
                groupSize: number | null;
                visitDateExpected: string | null;
                budgetEstimate: number | null;
                notes: string;
                assignedTo: string | null;
                followUpAt: string | null;
              };
            }
          | null;
        if (!response.ok || !payload?.lead) {
          throw new Error(payload?.message ?? "Could not load lead details");
        }
        if (!active) return;
        setName(payload.lead.name ?? "");
        setMobile(payload.lead.mobile ?? "");
        setEmail(payload.lead.email ?? "");
        setType(payload.lead.type ?? "INDIVIDUAL");
        setSource(payload.lead.source ?? "WEBSITE");
        setStage(payload.lead.stage ?? "NEW");
        setGroupSize(payload.lead.groupSize ? String(payload.lead.groupSize) : "");
        setExpectedVisit(formatDateForInput(payload.lead.visitDateExpected));
        setBudget(payload.lead.budgetEstimate !== null && payload.lead.budgetEstimate !== undefined ? String(payload.lead.budgetEstimate) : "");
        setNotes(payload.lead.notes ?? "");
        setAssignedTo(payload.lead.assignedTo ?? "");
        setFollowUpAt(formatDateTimeForInput(payload.lead.followUpAt));
      })
      .catch((error) => {
        if (!active) return;
        setFormError(error instanceof Error ? error.message : "Failed to load lead");
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, mode, leadId]);

  return (
    <Drawer open={open} onClose={onClose} title={mode === "create" ? "Add Lead" : "Edit Lead"} widthClassName="w-full max-w-xl">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setFormError("");
          startTransition(() => {
            const url = mode === "create" ? "/api/v1/crm/leads" : `/api/v1/crm/leads/${leadId}`;
            const method = mode === "create" ? "POST" : "PUT";
            void fetch(url, {
              method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name,
                mobile,
                email: email || null,
                type,
                source,
                stage,
                groupSize: groupSize ? Number(groupSize) : null,
                expectedVisit: expectedVisit || null,
                budget: budget ? Number(budget) : null,
                notes,
                assignedTo: assignedTo || null,
                followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
              }),
            })
              .then(async (response) => {
                const payload = (await response.json().catch(() => null)) as { message?: string } | null;
                if (!response.ok) {
                  throw new Error(payload?.message ?? `Could not ${mode === "create" ? "create" : "update"} lead`);
                }
                clearForm();
                onClose();
                if (mode === "create") onCreated?.();
                onSaved?.();
                pushToast({
                  title: mode === "create" ? "Lead created" : "Lead updated",
                  variant: "success",
                });
              })
              .catch((error) => {
                setFormError(error instanceof Error ? error.message : "Failed to save lead");
              });
          });
        }}
      >
        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        {isLoading ? <p className="text-sm text-[var(--color-text-muted)]">Loading lead details…</p> : null}
        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
        <Input label="Mobile" value={mobile} onChange={(event) => setMobile(event.target.value)} required />
        <Input label="Email (Optional)" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Select label="Lead Type" value={type} onChange={(event) => setType(event.target.value)} options={typeOptions} />
        <Select label="Source" value={source} onChange={(event) => setSource(event.target.value)} options={sourceOptions} />
        <Select
          label="Stage"
          value={stage}
          onChange={(event) => setStage(event.target.value)}
          options={[
            { label: "NEW", value: "NEW" },
            { label: "CONTACTED", value: "CONTACTED" },
            { label: "INTERESTED", value: "INTERESTED" },
            { label: "PROPOSAL_SENT", value: "PROPOSAL_SENT" },
            { label: "BOOKED", value: "BOOKED" },
            { label: "LOST", value: "LOST" },
          ]}
        />
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

        <Button type="submit" loading={isPending} className="w-full" disabled={isLoading}>
          {mode === "create" ? "Create Lead" : "Save Lead"}
        </Button>
      </form>
    </Drawer>
  );
}
