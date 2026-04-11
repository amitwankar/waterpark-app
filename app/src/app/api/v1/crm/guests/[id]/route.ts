import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { maskUpiRef } from "@/lib/encryption";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().max(255).optional().nullable(),
  dob: z.string().date().optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

function getRole(session: unknown): string {
  const candidate = session as { user?: { role?: string } };
  return String(candidate?.user?.role ?? "USER");
}

function extractNotes(tags: string[]): string {
  const noteTag = tags.find((tag: string) => tag.startsWith("__note:"));
  if (!noteTag) return "";
  try {
    return Buffer.from(noteTag.slice("__note:".length), "base64url").toString("utf8");
  } catch {
    return "";
  }
}

function mergeTags(tags: string[], notes?: string | null): string[] {
  const cleaned = tags.filter((tag: string) => !tag.startsWith("__note:"));
  const noteText = (notes ?? "").trim();
  if (noteText.length === 0) {
    return cleaned;
  }

  const encoded = Buffer.from(noteText, "utf8").toString("base64url");
  return [...cleaned, `__note:${encoded}`];
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

  const profile = await db.guestProfile.findUnique({
    where: { id },
    include: {
      loyaltyTransactions: {
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ message: "Guest not found" }, { status: 404 });
  }

  const [bookings, communications] = await Promise.all([
    db.booking.findMany({
      where: { guestMobile: profile.mobile },
      include: {
        transactions: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.communicationLog.findMany({
      where: {
        OR: [
          { referenceType: "guest", referenceId: profile.id },
          { recipientMobile: profile.mobile },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        template: { select: { name: true } },
      },
    }),
  ]);

  const monthlyMap = new Map<string, { spend: number; visits: number }>();
  for (const booking of bookings) {
    if (booking.status === "CANCELLED") continue;
    const key = `${booking.createdAt.getFullYear()}-${String(booking.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const existing = monthlyMap.get(key) ?? { spend: 0, visits: 0 };
    existing.spend += Number(booking.totalAmount);
    existing.visits += 1;
    monthlyMap.set(key, existing);
  }

  return NextResponse.json({
    profile: {
      ...profile,
      totalSpend: Number(profile.totalSpend),
      notes: extractNotes(profile.tags),
      tags: profile.tags.filter((tag: string) => !tag.startsWith("__note:")),
      loyaltyTransactions: profile.loyaltyTransactions,
    },
    bookings: bookings.map((booking: any) => ({
      ...booking,
      subtotal: Number(booking.subtotal),
      gstAmount: Number(booking.gstAmount),
      discountAmount: Number(booking.discountAmount),
      totalAmount: Number(booking.totalAmount),
      transactions: booking.transactions.map((transaction: any) => ({
        id: transaction.id,
        bookingId: transaction.bookingId,
        posSessionId: transaction.posSessionId,
        amount: Number(transaction.amount),
        method: transaction.method,
        status: transaction.status,
        gatewayRef: transaction.gatewayRef,
        upiRefMasked: maskUpiRef(transaction.upiRef),
        upiScreenshot: transaction.upiScreenshot,
        verifiedById: transaction.verifiedById,
        verifiedAt: transaction.verifiedAt,
        notes: transaction.notes,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      })),
    })),
    communications,
    analytics: {
      monthly: Array.from(monthlyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, value]) => ({ month, ...value })),
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

  const { id } = await Promise.resolve(context.params);

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.guestProfile.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: "Guest not found" }, { status: 404 });
  }

  const nextTags = mergeTags(parsed.data.tags ?? existing.tags, parsed.data.notes ?? extractNotes(existing.tags));

  const updated = await db.guestProfile.update({
    where: { id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.email !== undefined ? { email: parsed.data.email || null } : {}),
      ...(parsed.data.dob !== undefined ? { dob: parsed.data.dob ? new Date(parsed.data.dob) : null } : {}),
      tags: nextTags,
    },
  });

  return NextResponse.json({
    guest: {
      ...updated,
      totalSpend: Number(updated.totalSpend),
      notes: extractNotes(updated.tags),
      tags: updated.tags.filter((tag: string) => !tag.startsWith("__note:")),
    },
  });
}
