import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

const inquirySchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    mobile: z.string().trim().regex(/^[6-9]\d{9}$/),
    email: z.string().trim().email().max(255).optional(),
    groupSize: z.number().int().min(1).max(100000).optional(),
    expectedVisit: z.string().date().optional(),
    budget: z.number().min(0).max(100000000).optional(),
    message: z.string().trim().max(3000).optional(),
  })
  .strict();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit({
    endpoint: "website-inquiry",
    identifier: ip,
    limit: 5,
    windowSec: 60 * 60,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Too many inquiries. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSec),
        },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Please provide valid inquiry details." },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const notes = [
    "Public website inquiry",
    data.message ? `Message: ${data.message}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const lead = await db.lead.create({
    data: {
      name: data.name,
      mobile: data.mobile,
      email: data.email ?? null,
      source: "WEBSITE",
      stage: "NEW",
      groupSize: data.groupSize ?? null,
      visitDateExpected: data.expectedVisit ? new Date(data.expectedVisit) : null,
      budgetEstimate: data.budget ?? null,
      notes: notes || null,
    },
    select: {
      id: true,
    },
  });

  return NextResponse.json({
    success: true,
    leadId: lead.id,
    message: "Inquiry submitted successfully.",
  });
}
