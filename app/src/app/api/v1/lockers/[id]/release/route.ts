import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireSubRole } from "@/lib/session";

const releaseSchema = z.object({
  assignmentId: z.string().min(1),
  notes: z.string().optional(),
});

/**
 * POST /api/v1/lockers/[id]/release
 * Marks the active assignment as returned and makes locker AVAILABLE again.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireSubRole("LOCKER_ATTENDANT");
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = releaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const locker = await db.locker.findUnique({ where: { id } });
  if (!locker) {
    return NextResponse.json({ error: "Locker not found" }, { status: 404 });
  }
  if (locker.status !== "ASSIGNED") {
    return NextResponse.json(
      { error: `Locker is not currently assigned (status: ${locker.status})` },
      { status: 409 }
    );
  }

  const assignment = await db.lockerAssignment.findFirst({
    where: { id: parsed.data.assignmentId, lockerId: id, returnedAt: null },
  });
  if (!assignment) {
    return NextResponse.json(
      { error: "Active assignment not found" },
      { status: 404 }
    );
  }

  const now = new Date();
  const [updated] = await db.$transaction([
    db.lockerAssignment.update({
      where: { id: assignment.id },
      data: {
        returnedAt: now,
        returnedById: user!.id,
        notes: parsed.data.notes
          ? `${assignment.notes ?? ""}\nReturn: ${parsed.data.notes}`.trim()
          : assignment.notes,
      },
    }),
    db.locker.update({
      where: { id },
      data: { status: "AVAILABLE" },
    }),
  ]);

  return NextResponse.json(updated);
}
