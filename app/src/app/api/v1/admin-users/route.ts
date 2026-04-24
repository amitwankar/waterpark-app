import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const admins = await db.user.findMany({
    where: {
      role: "ADMIN",
      isDeleted: false,
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      mobile: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json(admins);
}
