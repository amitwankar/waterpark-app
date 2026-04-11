import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const leadTypeValues = [
  "INDIVIDUAL",
  "CORPORATE",
  "SCHOOL",
  "WEDDING",
  "BIRTHDAY_PARTY",
  "TOUR_GROUP",
] as const;

const leadSourceValues = ["WEBSITE", "WHATSAPP", "PHONE", "WALKIN", "SOCIAL", "REFERRAL", "EVENT"] as const;
const leadStageValues = ["NEW", "CONTACTED", "INTERESTED", "PROPOSAL_SENT", "BOOKED", "LOST"] as const;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  stage: z.enum(leadStageValues).optional(),
  source: z.enum(leadSourceValues).optional(),
  followUpDue: z.enum(["1", "0"]).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/),
  email: z.string().trim().email().max(255).optional().nullable(),
  source: z.enum(leadSourceValues),
  stage: z.enum(leadStageValues).optional(),
  type: z.enum(leadTypeValues),
  groupSize: z.coerce.number().int().min(1).max(100000).optional().nullable(),
  expectedVisit: z.string().date().optional().nullable(),
  budget: z.coerce.number().min(0).max(100000000).optional().nullable(),
  notes: z.string().trim().max(3000).optional().nullable(),
  assignedTo: z.string().cuid().optional().nullable(),
  followUpAt: z.string().datetime().optional().nullable(),
});

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

function getUserId(session: unknown): string | null {
  const candidate = session as { user?: { id?: string } };
  return candidate?.user?.id ?? null;
}

function packLeadNotes(type: (typeof leadTypeValues)[number], notes?: string | null): string {
  const meta = `CRM_META:${JSON.stringify({ type })}`;
  const body = (notes ?? "").trim();
  return body ? `${meta}\n${body}` : meta;
}

function unpackLeadNotes(raw: string | null): { type: (typeof leadTypeValues)[number] | null; notes: string } {
  const text = raw ?? "";
  const [line, ...rest] = text.split("\n");
  if (!line.startsWith("CRM_META:")) {
    return { type: null, notes: text };
  }

  try {
    const parsed = JSON.parse(line.slice("CRM_META:".length)) as { type?: (typeof leadTypeValues)[number] };
    return {
      type: parsed.type ?? null,
      notes: rest.join("\n").trim(),
    };
  } catch {
    return { type: null, notes: text };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  const role = getRole(session);
  if (role !== "ADMIN" && role !== "EMPLOYEE") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid query", errors: parsed.error.flatten() }, { status: 400 });
  }

  const query = parsed.data;

  const where: any = {
    isDeleted: false,
    ...(query.stage ? { stage: query.stage } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { mobile: { contains: query.search } },
            { email: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.followUpDue === "1"
      ? {
          followUpAt: { lte: new Date() },
          stage: { notIn: ["BOOKED", "LOST"] },
        }
      : {}),
  };

  const [total, leads, followUpDueCount] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: [{ followUpAt: "asc" }, { createdAt: "desc" }],
      include: {
        assignee: {
          select: { id: true, name: true, mobile: true },
        },
      },
    }),
    db.lead.count({
      where: {
        isDeleted: false,
        followUpAt: { lte: new Date() },
        stage: { notIn: ["BOOKED", "LOST"] },
      },
    }),
  ]);

  return NextResponse.json({
    items: leads.map((lead: any) => {
      const parsedNotes = unpackLeadNotes(lead.notes);
      return {
        ...lead,
        budgetEstimate: lead.budgetEstimate ? Number(lead.budgetEstimate) : null,
        type: parsedNotes.type,
        notes: parsedNotes.notes,
      };
    }),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
    followUpDueCount,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  const role = getRole(session);
  if (role !== "ADMIN" && role !== "EMPLOYEE") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const userId = getUserId(session);
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;

  const created = await db.lead.create({
    data: {
      name: payload.name,
      mobile: payload.mobile,
      email: payload.email || null,
      source: payload.source as any,
      stage: (payload.stage ?? "NEW") as any,
      groupSize: payload.groupSize ?? null,
      visitDateExpected: payload.expectedVisit ? new Date(payload.expectedVisit) : null,
      budgetEstimate: payload.budget !== null && payload.budget !== undefined ? payload.budget : null,
      notes: packLeadNotes(payload.type, payload.notes),
      assignedTo: payload.assignedTo || null,
      followUpAt: payload.followUpAt ? new Date(payload.followUpAt) : null,
    },
  });

  await db.leadActivity.create({
    data: {
      leadId: created.id,
      activityType: "NOTE",
      notes: "Lead created",
      performedBy: userId,
    },
  });

  return NextResponse.json({ lead: created }, { status: 201 });
}
