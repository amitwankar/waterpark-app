"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { LeadProposalMeta, ProposalStatus } from "@/lib/crm-meta";

interface LeadProposalEditorProps {
  leadId: string;
  initialProposal: LeadProposalMeta | null | undefined;
}

const STATUS_OPTIONS: Array<{ label: string; value: ProposalStatus }> = [
  { label: "Draft", value: "DRAFT" },
  { label: "Sent", value: "SENT" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Rejected", value: "REJECTED" },
];

export function LeadProposalEditor({ leadId, initialProposal }: LeadProposalEditorProps): JSX.Element {
  const router = useRouter();
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [proposal, setProposal] = useState<LeadProposalMeta>({
    title: initialProposal?.title ?? "",
    summary: initialProposal?.summary ?? "",
    quotedAmount: initialProposal?.quotedAmount ?? null,
    validUntil: initialProposal?.validUntil ?? null,
    status: initialProposal?.status ?? "DRAFT",
  });

  async function saveProposal(): Promise<void> {
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/crm/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposal: {
            title: proposal.title?.trim() || null,
            summary: proposal.summary?.trim() || null,
            quotedAmount: proposal.quotedAmount ?? null,
            validUntil: proposal.validUntil || null,
            status: proposal.status ?? "DRAFT",
          },
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to save proposal");
      }

      pushToast({ title: "Proposal saved", variant: "success" });
      router.refresh();
    } catch (error) {
      pushToast({
        title: "Unable to save proposal",
        message: error instanceof Error ? error.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <Input
        label="Proposal Title"
        value={proposal.title ?? ""}
        onChange={(event) => setProposal((current) => ({ ...current, title: event.target.value }))}
        placeholder="Corporate package for 150 guests"
      />

      <div className="grid gap-3 md:grid-cols-2">
        <Input
          label="Quoted Amount (Rs)"
          type="number"
          min={0}
          value={proposal.quotedAmount ?? ""}
          onChange={(event) =>
            setProposal((current) => ({
              ...current,
              quotedAmount: event.target.value.length ? Number(event.target.value) : null,
            }))
          }
          placeholder="0"
        />
        <Input
          label="Valid Until"
          type="date"
          value={proposal.validUntil ?? ""}
          onChange={(event) => setProposal((current) => ({ ...current, validUntil: event.target.value || null }))}
        />
      </div>

      <Select
        label="Proposal Status"
        value={proposal.status ?? "DRAFT"}
        onChange={(event) => setProposal((current) => ({ ...current, status: event.target.value as ProposalStatus }))}
        options={STATUS_OPTIONS}
      />

      <div className="space-y-1.5">
        <label htmlFor="proposal-summary" className="text-sm font-medium text-[var(--color-text)]">
          Proposal Details
        </label>
        <textarea
          id="proposal-summary"
          value={proposal.summary ?? ""}
          onChange={(event) => setProposal((current) => ({ ...current, summary: event.target.value }))}
          rows={10}
          maxLength={5000}
          className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
          placeholder="Scope, inclusions, exclusions, payment terms, special conditions."
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={() => void saveProposal()} loading={saving}>
          Save Proposal
        </Button>
      </div>
    </div>
  );
}

