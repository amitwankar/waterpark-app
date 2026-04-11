import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser, requireAdmin } from "@/lib/rides";

const channelValues = ["SMS", "WHATSAPP", "EMAIL"] as const;

const createTemplateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  channel: z.enum(channelValues),
  subject: z.string().trim().max(200).optional().nullable(),
  body: z.string().trim().min(3).max(10_000),
  variables: z.array(z.string().trim().min(1).max(50)).default([]),
  isSystem: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

function detectVariables(body: string): string[] {
  const set = new Set<string>();
  const regex = /\{([a-zA-Z0-9_]+)\}/g;
  let match: RegExpExecArray | null = regex.exec(body);
  while (match) {
    set.add(match[1]);
    match = regex.exec(body);
  }
  return Array.from(set);
}

function isSystemTemplate(name: string): boolean {
  return name.startsWith("system.") || name.startsWith("booking_") || name.startsWith("payment_");
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const channel = request.nextUrl.searchParams.get("channel");

  const templates = await db.messageTemplate.findMany({
    where: {
      ...(channel ? { channel: channel as any } : {}),
    },
    orderBy: [{ channel: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    items: templates.map((template: any) => ({
      ...template,
      isSystem: isSystemTemplate(template.name),
      smsCredits:
        template.channel === "SMS"
          ? Math.max(1, Math.ceil((template.body?.length ?? 0) / 160))
          : null,
    })),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdmin(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = createTemplateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const created = await db.messageTemplate.create({
    data: {
      name: parsed.data.name,
      channel: parsed.data.channel,
      subject: parsed.data.subject ?? null,
      body: parsed.data.body,
      variables: parsed.data.variables.length > 0 ? parsed.data.variables : detectVariables(parsed.data.body),
      isActive: parsed.data.isActive ?? true,
    },
  });

  return NextResponse.json({
    template: {
      ...created,
      isSystem: parsed.data.isSystem ?? isSystemTemplate(created.name),
    },
  }, { status: 201 });
}
