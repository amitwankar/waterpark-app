import { notFound } from "next/navigation";

import { ActivityTimeline } from "@/components/crm/ActivityTimeline";
import { LeadNotesEditor } from "@/components/crm/LeadNotesEditor";
import { LeadProposalEditor } from "@/components/crm/LeadProposalEditor";
import { LeadQuickActions } from "@/components/crm/LeadQuickActions";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { unpackLeadMeta } from "@/lib/crm-meta";
import { db } from "@/lib/db";

interface LeadDetailPageProps {
  params: Promise<{ id: string }> | { id: string };
  searchParams:
    | Promise<{ tab?: "timeline" | "notes" | "proposal" }>
    | { tab?: "timeline" | "notes" | "proposal" };
}

export default async function LeadDetailPage({ params, searchParams }: LeadDetailPageProps): Promise<JSX.Element> {
  const { id } = await Promise.resolve(params);
  const { tab = "timeline" } = await Promise.resolve(searchParams);

  const lead = await db.lead.findFirst({
    where: { id, isDeleted: false },
    include: {
      assignee: { select: { name: true, mobile: true } },
      activities: {
        include: { performer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!lead) {
    notFound();
  }

  const parsed = unpackLeadMeta(lead.notes);
  const parsedType = parsed.meta.type ?? null;
  const parsedNotes = parsed.notes;
  const parsedProposal = parsed.meta.proposal ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[320px,1fr]">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Lead Info</h2>
        </CardHeader>
        <CardBody className="space-y-2 text-sm">
          <p className="text-[var(--color-text)] font-semibold">{lead.name}</p>
          <p className="text-[var(--color-text-muted)]">{lead.mobile}</p>
          <p><span className="text-[var(--color-text-muted)]">Email:</span> {lead.email ?? "-"}</p>
          <p><span className="text-[var(--color-text-muted)]">Source:</span> {lead.source}</p>
          <p><span className="text-[var(--color-text-muted)]">Type:</span> {parsedType ?? "-"}</p>
          <p><span className="text-[var(--color-text-muted)]">Group Size:</span> {lead.groupSize ?? "-"}</p>
          <p><span className="text-[var(--color-text-muted)]">Budget:</span> {lead.budgetEstimate ? `Rs ${Number(lead.budgetEstimate).toFixed(0)}` : "-"}</p>
          <p><span className="text-[var(--color-text-muted)]">Expected Visit:</span> {lead.visitDateExpected ? lead.visitDateExpected.toLocaleDateString("en-IN") : "-"}</p>
          <p><span className="text-[var(--color-text-muted)]">Follow-up:</span> {lead.followUpAt ? lead.followUpAt.toLocaleString("en-IN") : "-"}</p>
          <p><span className="text-[var(--color-text-muted)]">Assigned:</span> {lead.assignee?.name ?? "-"}</p>
          <div className="pt-1"><Badge variant="info">{lead.stage}</Badge></div>
        </CardBody>
      </Card>

      <div className="space-y-4 pb-24">
        <div className="flex flex-wrap gap-2">
          <a href={`?tab=timeline`}><Badge variant={tab === "timeline" ? "info" : "default"}>Activity Timeline</Badge></a>
          <a href={`?tab=notes`}><Badge variant={tab === "notes" ? "info" : "default"}>Notes</Badge></a>
          <a href={`?tab=proposal`}><Badge variant={tab === "proposal" ? "info" : "default"}>Proposal</Badge></a>
        </div>

        {tab === "timeline" ? (
          <ActivityTimeline
            items={lead.activities.map((item: any) => ({
              id: item.id,
              activityType: item.activityType,
              notes: item.notes,
              createdAt: item.createdAt.toISOString(),
              performerName: item.performer.name,
            }))}
          />
        ) : null}

        {tab === "notes" ? (
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--color-text)]">Notes</h3>
            </CardHeader>
            <CardBody>
              <LeadNotesEditor leadId={lead.id} initialNotes={parsedNotes} />
            </CardBody>
          </Card>
        ) : null}

        {tab === "proposal" ? (
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--color-text)]">Proposal</h3>
            </CardHeader>
            <CardBody>
              <LeadProposalEditor leadId={lead.id} initialProposal={parsedProposal} />
            </CardBody>
          </Card>
        ) : null}
      </div>

      <LeadQuickActions leadId={lead.id} mobile={lead.mobile} />
    </div>
  );
}
