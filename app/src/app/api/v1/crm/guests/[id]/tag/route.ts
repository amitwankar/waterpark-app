import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const payloadSchema = z.object({
  action: z.enum(["add", "remove"]),
  tag: z.string().trim().min(1).max(40).regex(/^[a-zA-Z0-9_-]+$/),
});

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

function cleanTags(tags: string[]): string[] {
  return Array.from(new Set(tags.filter((tag: string) => !tag.startsWith("__note:"))));
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  const role = getRole(session);
  if (role !== "ADMIN" && role !== "EMPLOYEE") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);
  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const guest = await db.guestProfile.findUnique({ where: { id } });
  if (!guest) {
    return NextResponse.json({ message: "Guest not found" }, { status: 404 });
  }

  const noteTags = guest.tags.filter((tag: string) => tag.startsWith("__note:"));
  const normalTags = cleanTags(guest.tags);

  let nextTags = normalTags;
  if (parsed.data.action === "add") {
    nextTags = cleanTags([...normalTags, parsed.data.tag]);
  }

  if (parsed.data.action === "remove") {
    nextTags = normalTags.filter((tag: string) => tag !== parsed.data.tag);
  }

  const updated = await db.guestProfile.update({
    where: { id },
    data: { tags: [...nextTags, ...noteTags] },
    select: { id: true, tags: true },
  });

  return NextResponse.json({ id: updated.id, tags: updated.tags.filter((tag: string) => !tag.startsWith("__note:")) });
}
