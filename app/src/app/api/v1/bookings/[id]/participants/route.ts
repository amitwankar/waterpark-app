import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const payloadSchema = z
  .object({
    participants: z
      .array(
        z
          .object({
            id: z.string().min(1),
            name: z.string().trim().max(100).optional(),
            gender: z.enum(["MALE", "FEMALE", "OTHER"]).nullable().optional(),
            age: z.number().int().min(1).max(120).nullable().optional(),
            isLeadGuest: z.boolean().optional(),
          })
          .strict(),
      )
      .min(1),
    walkInDetailsPending: z.boolean().optional(),
  })
  .strict();

function sessionRoleAndSubRole(session: unknown): { role: string; subRole: string | null } {
  const user = (session as { user?: { role?: string; subRole?: string | null } })?.user;
  return {
    role: String(user?.role ?? "USER"),
    subRole: user?.subRole ?? null,
  };
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const params = await Promise.resolve(context.params);
  const bookingId = params.id;

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { role, subRole } = sessionRoleAndSubRole(session);
  const allowed = role === "ADMIN" || (role === "EMPLOYEE" && (subRole === "TICKET_COUNTER" || subRole === "SECURITY_STAFF"));

  if (!allowed) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, notes: true },
  });

  if (!booking) {
    return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  }

  const existingParticipants = await db.bookingParticipant.findMany({
    where: { bookingId },
    select: { id: true },
  });

  const existingIds = new Set(existingParticipants.map((participant: { id: string }) => participant.id));
  const requestedIds = parsed.data.participants.map((participant) => participant.id);

  if (requestedIds.some((id) => !existingIds.has(id))) {
    return NextResponse.json({ message: "Invalid participant id in payload" }, { status: 400 });
  }

  const updatedRows = parsed.data.participants.map((participant, index) => ({
    id: participant.id,
    name: participant.name?.trim().replace(/\s+/g, " ").slice(0, 100) || `Guest ${index + 1}`,
    gender: participant.gender ?? null,
    age: participant.age ?? null,
    isLeadGuest: Boolean(participant.isLeadGuest),
  }));

  const leadIndex = updatedRows.findIndex((participant) => participant.isLeadGuest);
  const normalizedLeadIndex = leadIndex >= 0 ? leadIndex : 0;

  for (let i = 0; i < updatedRows.length; i += 1) {
    updatedRows[i]!.isLeadGuest = i === normalizedLeadIndex;
  }

  await db.$transaction(async (tx: any) => {
    for (const row of updatedRows) {
      await tx.bookingParticipant.update({
        where: { id: row.id },
        data: {
          name: row.name,
          gender: row.gender,
          age: row.age,
          isLeadGuest: row.isLeadGuest,
        },
      });
    }

    if (parsed.data.walkInDetailsPending === true) {
      const marker = "WALK_IN_DETAILS_PENDING";
      const current = booking.notes ?? "";
      const next = current.includes(marker) ? current : `${current}${current ? "\n" : ""}${marker}`;
      await tx.booking.update({
        where: { id: bookingId },
        data: { notes: next },
      });
    }
  });

  return NextResponse.json({ success: true });
}
