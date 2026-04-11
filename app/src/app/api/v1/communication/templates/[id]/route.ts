import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser, requireAdmin } from "@/lib/rides";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  channel: z.enum(["SMS", "WHATSAPP", "EMAIL"]).optional(),
  subject: z.string().trim().max(200).optional().nullable(),
  body: z.string().trim().min(3).max(10_000).optional(),
  variables: z.array(z.string().trim().min(1).max(50)).optional(),
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

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdmin(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);
  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.messageTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: "Template not found" }, { status: 404 });
  }

  const updated = await db.messageTemplate.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.channel !== undefined ? { channel: parsed.data.channel } : {}),
      ...(parsed.data.subject !== undefined ? { subject: parsed.data.subject ?? null } : {}),
      ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
      ...(parsed.data.variables !== undefined
        ? { variables: parsed.data.variables }
        : parsed.data.body !== undefined
          ? { variables: detectVariables(parsed.data.body) }
          : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
    },
  });

  return NextResponse.json({ template: { ...updated, isSystem: isSystemTemplate(updated.name) } });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdmin(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);

  const existing = await db.messageTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: "Template not found" }, { status: 404 });
  }

  if (isSystemTemplate(existing.name)) {
    return NextResponse.json({ message: "System templates cannot be deleted" }, { status: 400 });
  }

  await db.messageTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
