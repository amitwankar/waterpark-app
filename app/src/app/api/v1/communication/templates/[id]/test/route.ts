import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { sendEmail, sendSMS, sendWhatsApp } from "@/lib/messaging";
import { getSessionUser, requireAdmin } from "@/lib/rides";

const testSchema = z.object({
  mobile: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  sampleData: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

function render(body: string, data: Record<string, unknown>): string {
  return body.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const value = data[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!requireAdmin(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await Promise.resolve(context.params);
  const payload = await request.json().catch(() => null);
  const parsed = testSchema.safeParse(payload ?? {});

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const template = await db.messageTemplate.findUnique({ where: { id } });
  if (!template) {
    return NextResponse.json({ message: "Template not found" }, { status: 404 });
  }

  const sampleData = parsed.data.sampleData ?? {
    name: "Test Guest",
    bookingNumber: "WPTEST123",
    visitDate: new Date().toLocaleDateString("en-IN"),
    amount: 999,
    balance: 0,
    otp: "123456",
    parkName: "AquaWorld Park",
    qrLink: "https://example.com/qr/test",
    paymentLink: "https://example.com/pay/test",
    year: new Date().getFullYear(),
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN"),
  };

  const body = render(template.body, sampleData);

  let result: { ok: boolean; error?: string } = { ok: false };

  if (template.channel === "SMS") {
    if (!parsed.data.mobile) {
      return NextResponse.json({ message: "mobile is required for SMS test" }, { status: 400 });
    }
    result = await sendSMS(parsed.data.mobile, body);
  } else if (template.channel === "WHATSAPP") {
    if (!parsed.data.mobile) {
      return NextResponse.json({ message: "mobile is required for WhatsApp test" }, { status: 400 });
    }
    result = await sendWhatsApp(parsed.data.mobile, body);
  } else {
    if (!parsed.data.email) {
      return NextResponse.json({ message: "email is required for Email test" }, { status: 400 });
    }
    result = await sendEmail(parsed.data.email, template.subject ?? "Template Test", body);
  }

  await db.communicationLog.create({
    data: {
      recipientMobile: parsed.data.mobile ?? null,
      recipientEmail: parsed.data.email ?? null,
      channel: template.channel,
      templateId: template.id,
      status: result.ok ? "SENT" : "FAILED",
      payload: { sampleData, body },
      sentAt: result.ok ? new Date() : null,
      errorMessage: result.error ?? null,
      referenceType: "template_test",
      referenceId: template.id,
    },
  });

  return NextResponse.json({ ok: result.ok, error: result.error ?? null });
}
