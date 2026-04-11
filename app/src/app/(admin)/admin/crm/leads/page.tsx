import Link from "next/link";

import { AddLeadModal } from "@/components/crm/AddLeadModal";
import { ConversionMetrics } from "@/components/crm/ConversionMetrics";
import { FollowUpDueCard } from "@/components/crm/FollowUpDueCard";
import { LeadKanban } from "@/components/crm/LeadKanban";
import { LeadTable } from "@/components/crm/LeadTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { unpackLeadMeta } from "@/lib/crm-meta";
import { db } from "@/lib/db";

interface LeadsPageProps {
  searchParams:
    | Promise<{
        view?: "kanban" | "table";
        search?: string;
        stage?: string;
        source?: string;
        followUpDue?: "1" | "0";
      }>
    | {
        view?: "kanban" | "table";
        search?: string;
        stage?: string;
        source?: string;
        followUpDue?: "1" | "0";
      };
}

async function getAnalyticsCached(): Promise<{
  conversionRate: number;
  lossRate: number;
  stageBreakdown: Array<{ stage: string; count: number }>;
  dueCount: number;
  overdue: number;
}> {
  "use cache";

  const [totalLeads, bookedLeads, lostLeads, stageBreakdown, dueCount, overdue] = await Promise.all([
    db.lead.count({ where: { isDeleted: false } }),
    db.lead.count({ where: { isDeleted: false, stage: "BOOKED" as any } }),
    db.lead.count({ where: { isDeleted: false, stage: "LOST" as any } }),
    db.lead.groupBy({ by: ["stage"], where: { isDeleted: false }, _count: { _all: true } }),
    db.lead.count({ where: { isDeleted: false, followUpAt: { lte: new Date() }, stage: { notIn: ["BOOKED", "LOST"] as any } } }),
    db.lead.count({ where: { isDeleted: false, followUpAt: { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, stage: { notIn: ["BOOKED", "LOST"] as any } } }),
  ]);

  return {
    conversionRate: totalLeads > 0 ? (bookedLeads / totalLeads) * 100 : 0,
    lossRate: totalLeads > 0 ? (lostLeads / totalLeads) * 100 : 0,
    stageBreakdown: stageBreakdown.map((row: any) => ({ stage: row.stage, count: row._count._all })),
    dueCount,
    overdue,
  };
}

function buildViewHref(params: { search?: string; stage?: string; source?: string; followUpDue?: string }, view: "kanban" | "table"): string {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.stage) qs.set("stage", params.stage);
  if (params.source) qs.set("source", params.source);
  if (params.followUpDue) qs.set("followUpDue", params.followUpDue);
  qs.set("view", view);
  return `/admin/crm/leads?${qs.toString()}`;
}

export default async function CrmLeadsPage({ searchParams }: LeadsPageProps): Promise<JSX.Element> {
  const params = await Promise.resolve(searchParams);
  const view = params.view ?? "kanban";

  const where: any = {
    isDeleted: false,
    ...(params.stage ? { stage: params.stage } : {}),
    ...(params.source ? { source: params.source } : {}),
    ...(params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: "insensitive" } },
            { mobile: { contains: params.search } },
            { email: { contains: params.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(params.followUpDue === "1"
      ? { followUpAt: { lte: new Date() }, stage: { notIn: ["BOOKED", "LOST"] } }
      : {}),
  };

  const [leads, assignees, analytics] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: [{ followUpAt: "asc" }, { createdAt: "desc" }],
      include: { assignee: { select: { id: true, name: true } } },
      take: 500,
    }),
    db.user.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        OR: [{ role: "ADMIN" }, { role: "EMPLOYEE", subRole: "SALES_EXECUTIVE" }],
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getAnalyticsCached(),
  ]);

  const leadRows = leads.map((lead: any) => {
    const parsed = unpackLeadMeta(lead.notes);
    const type = parsed.meta.type ?? null;
    const notes = parsed.notes;

    return {
      id: lead.id,
      name: lead.name,
      mobile: lead.mobile,
      source: lead.source,
      type,
      stage: lead.stage,
      groupSize: lead.groupSize,
      budgetEstimate: lead.budgetEstimate ? Number(lead.budgetEstimate) : null,
      followUpAt: lead.followUpAt ? lead.followUpAt.toISOString() : null,
      assignedToName: lead.assignee?.name ?? null,
      notes,
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">Lead Pipeline</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Track, convert and follow-up every prospect</p>
        </div>
        <AddLeadModal assignees={assignees} />
      </div>

      <FollowUpDueCard count={analytics.dueCount} overdueMoreThanOneDay={analytics.overdue} />

      <Card>
        <CardBody className="space-y-3">
          <form action="/admin/crm/leads" method="get" className="grid gap-3 lg:grid-cols-5">
            <input type="hidden" name="view" value={view} />
            <Input name="search" defaultValue={params.search} placeholder="Search lead" />
            <Select
              name="stage"
              defaultValue={params.stage ?? ""}
              placeholder="All stages"
              options={[
                { label: "NEW", value: "NEW" },
                { label: "CONTACTED", value: "CONTACTED" },
                { label: "INTERESTED", value: "INTERESTED" },
                { label: "PROPOSAL_SENT", value: "PROPOSAL_SENT" },
                { label: "BOOKED", value: "BOOKED" },
                { label: "LOST", value: "LOST" },
              ]}
            />
            <Select
              name="source"
              defaultValue={params.source ?? ""}
              placeholder="All sources"
              options={[
                { label: "WEBSITE", value: "WEBSITE" },
                { label: "WHATSAPP", value: "WHATSAPP" },
                { label: "PHONE", value: "PHONE" },
                { label: "WALKIN", value: "WALKIN" },
                { label: "SOCIAL", value: "SOCIAL" },
                { label: "REFERRAL", value: "REFERRAL" },
                { label: "EVENT", value: "EVENT" },
              ]}
            />
            <Select name="followUpDue" defaultValue={params.followUpDue ?? "0"} options={[{ label: "All", value: "0" }, { label: "Due only", value: "1" }]} />
            <Button type="submit">Apply</Button>
          </form>

          <div className="flex items-center gap-2">
            <Link href={buildViewHref(params, "kanban")}>
              <Badge variant={view === "kanban" ? "info" : "default"}>Kanban view</Badge>
            </Link>
            <Link href={buildViewHref(params, "table")}>
              <Badge variant={view === "table" ? "info" : "default"}>Table view</Badge>
            </Link>
          </div>
        </CardBody>
      </Card>

      <ConversionMetrics conversionRate={analytics.conversionRate} lossRate={analytics.lossRate} stageBreakdown={analytics.stageBreakdown} />

      {view === "kanban" ? (
        <LeadKanban
          leads={leadRows.map((lead: any) => ({
            id: lead.id,
            name: lead.name,
            mobile: lead.mobile,
            source: lead.source,
            stage: lead.stage as "NEW" | "CONTACTED" | "INTERESTED" | "PROPOSAL_SENT" | "BOOKED" | "LOST",
            groupSize: lead.groupSize,
            budgetEstimate: lead.budgetEstimate,
            followUpAt: lead.followUpAt,
          }))}
        />
      ) : (
        <LeadTable rows={leadRows as any} />
      )}
    </div>
  );
}
