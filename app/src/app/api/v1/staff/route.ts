import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { MOBILE_REGEX } from "@/types/auth";

const createSchema = z.object({
  name: z.string().min(1).max(150),
  mobile: z.string().regex(MOBILE_REGEX, "Invalid Indian mobile number"),
  email: z.string().email().optional(),
  password: z.string().min(8).max(64),
  subRole: z.enum([
    "TICKET_COUNTER",
    "FB_STAFF",
    "RIDE_OPERATOR",
    "MAINTENANCE_TECH",
    "LOCKER_ATTENDANT",
    "COSTUME_ATTENDANT",
    "SALES_EXECUTIVE",
    "SECURITY_STAFF",
    "EVENT_COORDINATOR",
  ]),
  employeeCode: z.string().min(1).max(30),
  department: z.string().optional(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const subRole = searchParams.get("subRole");
  const isActive = searchParams.get("isActive");
  const q = searchParams.get("q");

  const staff = await db.user.findMany({
    where: {
      role: "EMPLOYEE",
      ...(subRole ? { subRole: subRole as never } : {}),
      ...(isActive !== null ? { isActive: isActive === "true" } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { mobile: { contains: q } },
              { staffProfile: { employeeCode: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      mobile: true,
      email: true,
      subRole: true,
      isActive: true,
      createdAt: true,
      staffProfile: {
        select: {
          id: true,
          employeeCode: true,
          department: true,
          joiningDate: true,
          isActive: true,
        },
      },
    },
  });

  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const { employeeCode, department, joiningDate, password, subRole, ...userFields } =
    parsed.data;

  // Check for duplicate mobile
  const existing = await db.user.findFirst({
    where: { mobile: userFields.mobile },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Mobile number already registered" },
      { status: 409 }
    );
  }

  // Check for duplicate employee code
  const codeExists = await db.staffProfile.findUnique({
    where: { employeeCode },
  });
  if (codeExists) {
    return NextResponse.json(
      { error: "Employee code already in use" },
      { status: 409 }
    );
  }

  // Hash password via bcrypt (Better Auth convention)
  const { hashPassword } = await import("@/lib/password");
  const passwordHash = await hashPassword(password);

  if (department?.trim()) {
    const departmentExists = await db.departmentMaster.findFirst({
      where: {
        name: { equals: department.trim(), mode: "insensitive" },
        isDeleted: false,
        isActive: true,
      },
      select: { id: true },
    });

    if (!departmentExists) {
      return NextResponse.json({ error: "Invalid department" }, { status: 422 });
    }
  }

  const user = await db.user.create({
    data: {
      ...userFields,
      role: "EMPLOYEE",
      subRole,
      passwordHash,
      emailVerified: false,
      staffProfile: {
        create: {
          employeeCode,
          department: department?.trim() || null,
          joiningDate: new Date(joiningDate),
        },
      },
    },
    select: {
      id: true,
      name: true,
      mobile: true,
      email: true,
      subRole: true,
      isActive: true,
      staffProfile: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
