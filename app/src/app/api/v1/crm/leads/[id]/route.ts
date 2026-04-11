import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { leadTypeValues, packLeadMeta, proposalStatusValues, unpackLeadMeta } from "@/lib/crm-meta";
import { db } from "@/lib/db";

const leadSourceValues = ["WEBSITE", "WHATSAPP", "PHONE", "WALKIN", "SOCIAL", "REFERRAL", "EVENT"] as const;
const leadStageValues = ["NEW", "CONTACTED", "INTERESTED", "PROPOSAL_SENT", "BOOKED", "LOST"] as const;

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/).optional(),
  email: z.string().trim().email().max(255).optional().nullable(),
  source: z.enum(leadSourceValues).optional(),
  stage: z.enum(leadStageValues).optional(),
  type: z.enum(leadTypeValues).optional(),
  groupSize: z.coerce.number().int().min(1).max(100000).optional().nullable(),
  expectedVisit: z.string().date().optional().nullable(),
  budget: z.coerce.number().min(0).max(100000000).optional().nullable(),
  notes: z.string().trim().max(3000).optional().nullable(),
  assignedTo: z.string().cuid().optional().nullable(),
  followUpAt: z.string().datetime().optional().nullable(),
  lostReason: z.string().trim().max(1000).optional().nullable(),
  proposal: z
    .object({
      title: z.string().trim().max(150).optional().nullable(),
      summary: z.string().trim().max(5000).optional().nullable(),
      quotedAmount: z.coerce.number().min(0).max(100000000).optional().nullable(),
      validUntil: z.string().date().optional().nullable(),
      status: z.enum(proposalStatusValues).optional().nullable(),
    })
    .strict()
    .optional()
    .nullable(),
});

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

function getUserId(session: unknown): string | null {
  const candidate = session as { user?: { id?: string } };
  return candidate?.user?.id ?? null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  const role = getRole(session);
  if (role !== "ADMIN" && role !== "EMPLOYEE") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);

  const lead = await db.lead.findFirst({
    where: { id, isDeleted: false },
    include: {
      assignee: { select: { id: true, name: true, mobile: true, subRole: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        include: {
          performer: { select: { id: true, name: true, mobile: true } },
        },
      },
    },
  });

  if (!lead) return NextResponse.json({ message: "Lead not found" }, { status: 404 });

  const parsed = unpackLeadMeta(lead.notes);

  return NextResponse.json({
    lead: {
      ...lead,
      budgetEstimate: lead.budgetEstimate ? Number(lead.budgetEstimate) : null,
      type: parsed.meta.type ?? null,
      proposal: parsed.meta.proposal ?? null,
      notes: parsed.notes,
    },
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  const role = getRole(session);
  if (role !== "ADMIN" && role !== "EMPLOYEE") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const userId = getUserId(session);
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await Promise.resolve(context.params);
  const existing = await db.lead.findFirst({ where: { id, isDeleted: false } });
  if (!existing) return NextResponse.json({ message: "Lead not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const oldParsed = unpackLeadMeta(existing.notes);
  const nextType = payload.type ?? oldParsed.meta.type ?? null;
  const nextNotes = payload.notes !== undefined ? payload.notes : oldParsed.notes;
  const nextProposal = payload.proposal !== undefined ? payload.proposal : oldParsed.meta.proposal ?? null;
  const packedNotes = packLeadMeta({ type: nextType, proposal: nextProposal }, nextNotes);

  const stageFromProposal =
    nextProposal?.status === "SENT"
      ? "PROPOSAL_SENT"
      : undefined;
  const nextStage = payload.stage ?? stageFromProposal;

  const updated = await db.lead.update({
    where: { id: existing.id },
    data: {
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.mobile ? { mobile: payload.mobile } : {}),
      ...(payload.email !== undefined ? { email: payload.email || null } : {}),
      ...(payload.source ? { source: payload.source as any } : {}),
      ...(nextStage ? { stage: nextStage as any } : {}),
      ...(payload.groupSize !== undefined ? { groupSize: payload.groupSize ?? null } : {}),
      ...(payload.expectedVisit !== undefined ? { visitDateExpected: payload.expectedVisit ? new Date(payload.expectedVisit) : null } : {}),
      ...(payload.budget !== undefined ? { budgetEstimate: payload.budget !== null ? payload.budget : null } : {}),
      ...(payload.assignedTo !== undefined ? { assignedTo: payload.assignedTo || null } : {}),
      ...(payload.followUpAt !== undefined ? { followUpAt: payload.followUpAt ? new Date(payload.followUpAt) : null } : {}),
      ...(payload.lostReason !== undefined ? { lostReason: payload.lostReason || null } : {}),
      notes: packedNotes,
    },
  });

  if (nextStage && nextStage !== (existing.stage as any)) {
    await db.leadActivity.create({
      data: {
        leadId: existing.id,
        activityType: "STAGE_CHANGE",
        notes: `Stage changed from ${existing.stage} to ${nextStage}`,
        performedBy: userId,
      },
    });
  }

  if (payload.followUpAt !== undefined) {
    await db.leadActivity.create({
      data: {
        leadId: existing.id,
        activityType: "NOTE",
        notes: payload.followUpAt
          ? `Follow-up scheduled for ${new Date(payload.followUpAt).toLocaleString("en-IN")}`
          : "Follow-up cleared",
        performedBy: userId,
      },
    });
  }

  if (payload.proposal !== undefined) {
    const proposalText = nextProposal?.title?.trim() || "Proposal updated";
    await db.leadActivity.create({
      data: {
        leadId: existing.id,
        activityType: "NOTE",
        notes: proposalText,
        performedBy: userId,
      },
    });
  }

  return NextResponse.json({
    lead: {
      ...updated,
      budgetEstimate: updated.budgetEstimate ? Number(updated.budgetEstimate) : null,
      type: nextType,
      proposal: nextProposal,
      notes: nextNotes ?? "",
    },
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  const role = getRole(session);
  if (role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const userId = getUserId(session);
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await Promise.resolve(context.params);
  const lead = await db.lead.findFirst({ where: { id, isDeleted: false } });
  if (!lead) return NextResponse.json({ message: "Lead not found" }, { status: 404 });

  await db.lead.update({ where: { id: lead.id }, data: { isDeleted: true, deletedAt: new Date() } });
  await db.leadActivity.create({
    data: {
      leadId: lead.id,
      activityType: "NOTE",
      notes: "Lead soft-deleted",
      performedBy: userId,
    },
  });

  return NextResponse.json({ ok: true });
}
