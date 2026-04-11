import nodemailer, { type Transporter } from "nodemailer";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export type TransactionalType =
  | "booking.confirmed"
  | "payment.deposit_paid"
  | "payment.failed"
  | "payment.upi_verified"
  | "payment.upi_rejected"
  | "checkin.completed"
  | "birthday.today"
  | "anniversary.today";

export interface TransactionalPayload {
  [key: string]: string | number | null | undefined;
}

export interface CommunicationLogInput {
  recipientMobile?: string | null;
  recipientEmail?: string | null;
  channel: "SMS" | "WHATSAPP" | "EMAIL";
  templateId?: string | null;
  status: "QUEUED" | "SENT" | "FAILED";
  payload?: Prisma.InputJsonValue | null;
  sentAt?: Date | null;
  errorMessage?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
}

const transactionalTemplateMap: Record<TransactionalType, string> = {
  "booking.confirmed": "booking_confirmation",
  "payment.deposit_paid": "payment_deposit_paid",
  "payment.failed": "payment_failed",
  "payment.upi_verified": "payment_upi_verified",
  "payment.upi_rejected": "payment_upi_rejected",
  "checkin.completed": "checkin_welcome",
  "birthday.today": "birthday_offer",
  "anniversary.today": "anniversary_offer",
};

let transporterSingleton: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporterSingleton) return transporterSingleton;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP env vars are not configured");
  }

  transporterSingleton = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporterSingleton;
}

function sanitizeMobile(mobile: string): string {
  return mobile.replace(/\D/g, "").slice(-10);
}

function renderWithVariables(template: string, data: TransactionalPayload): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const value = data[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function resolveTemplate(
  name: string,
  data: TransactionalPayload,
): Promise<{ templateId: string; channel: "SMS" | "WHATSAPP" | "EMAIL"; subject: string | null; body: string } | null> {
  const template = await db.messageTemplate.findFirst({
    where: {
      name,
      isActive: true,
      channel: { in: ["SMS", "WHATSAPP", "EMAIL"] },
    },
    select: {
      id: true,
      channel: true,
      subject: true,
      body: true,
    },
  });

  if (!template) return null;
  if (template.channel !== "SMS" && template.channel !== "WHATSAPP" && template.channel !== "EMAIL") {
    return null;
  }

  return {
    templateId: template.id,
    channel: template.channel,
    subject: template.subject,
    body: renderWithVariables(template.body, data),
  };
}

export async function sendSMS(mobile: string, body: string): Promise<{ ok: boolean; response?: unknown; error?: string }> {
  const to = sanitizeMobile(mobile);

  if (process.env.NODE_ENV !== "production") {
    console.log("[SMS:DEV]", { to, body });
    return { ok: true, response: { mode: "dev" } };
  }

  const authKey = process.env.MSG91_AUTH_KEY;
  const sender = process.env.MSG91_SENDER_ID;

  if (!authKey || !sender) {
    return { ok: false, error: "MSG91 config missing" };
  }

  try {
    const response = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify({
        sender,
        route: "4",
        country: "91",
        sms: [{
          message: body,
          to: [to],
        }],
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, error: `MSG91 error ${response.status}` };
    }

    return { ok: true, response: payload };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "SMS send failed" };
  }
}

export async function sendWhatsApp(mobile: string, body: string): Promise<{ ok: boolean; response?: unknown; error?: string }> {
  const to = sanitizeMobile(mobile);

  if (process.env.NODE_ENV !== "production") {
    console.log("[WA:DEV]", { to, body });
    return { ok: true, response: { mode: "dev" } };
  }

  const authKey = process.env.MSG91_AUTH_KEY;
  const whatsappNumber = process.env.MSG91_WHATSAPP_NUMBER;

  if (!authKey || !whatsappNumber) {
    return { ok: false, error: "MSG91 WhatsApp config missing" };
  }

  try {
    const response = await fetch("https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify({
        integrated_number: whatsappNumber,
        content_type: "text",
        payload: {
          type: "text",
          text: body,
        },
        recipients: [{
          recipient: `91${to}`,
        }],
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, error: `MSG91 WA error ${response.status}` };
    }

    return { ok: true, response: payload };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "WhatsApp send failed" };
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; response?: unknown; error?: string }> {
  if (process.env.NODE_ENV !== "production") {
    console.log("[EMAIL:DEV]", { to, subject, html });
    return { ok: true, response: { mode: "dev" } };
  }

  try {
    const transport = getTransporter();
    const fromName = process.env.SMTP_FROM_NAME ?? "Waterpark";
    const fromEmail = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER;

    const response = await transport.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      html,
    });

    return { ok: true, response };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Email send failed" };
  }
}

export async function logCommunication(log: CommunicationLogInput): Promise<void> {
  await db.communicationLog.create({
    data: {
      recipientMobile: log.recipientMobile ?? null,
      recipientEmail: log.recipientEmail ?? null,
      channel: log.channel,
      templateId: log.templateId ?? null,
      status: log.status,
      payload: log.payload ?? Prisma.JsonNull,
      sentAt: log.sentAt ?? null,
      errorMessage: log.errorMessage ?? null,
      referenceId: log.referenceId ?? null,
      referenceType: log.referenceType ?? null,
    },
  });
}

export async function sendTransactional(
  type: TransactionalType,
  mobile: string,
  data: TransactionalPayload,
  email?: string,
): Promise<{ ok: boolean; channel?: string; error?: string }> {
  const templateName = transactionalTemplateMap[type];
  const resolved = await resolveTemplate(templateName, data);

  if (!resolved) {
    const fallbackBody = `${type}: ${JSON.stringify(data)}`;
    const smsResult = await sendSMS(mobile, fallbackBody);
    await logCommunication({
      recipientMobile: mobile,
      channel: "SMS",
      status: smsResult.ok ? "SENT" : "FAILED",
      payload: toJsonValue({ type, data, body: fallbackBody }),
      sentAt: smsResult.ok ? new Date() : null,
      errorMessage: smsResult.error ?? null,
    });
    return { ok: smsResult.ok, channel: "SMS", error: smsResult.error };
  }

  let sendResult: { ok: boolean; error?: string; response?: unknown } = { ok: false };

  if (resolved.channel === "SMS") {
    sendResult = await sendSMS(mobile, resolved.body);
  } else if (resolved.channel === "WHATSAPP") {
    sendResult = await sendWhatsApp(mobile, resolved.body);
  } else {
    if (!email) {
      sendResult = { ok: false, error: "Email required for EMAIL channel" };
    } else {
      sendResult = await sendEmail(email, resolved.subject ?? "Waterpark Notification", resolved.body);
    }
  }

  await logCommunication({
    recipientMobile: mobile,
    recipientEmail: email ?? null,
    templateId: resolved.templateId,
    channel: resolved.channel,
    status: sendResult.ok ? "SENT" : "FAILED",
    payload: toJsonValue({
      type,
      data,
      body: resolved.body,
      subject: resolved.subject,
      response: sendResult.response ?? null,
    }),
    sentAt: sendResult.ok ? new Date() : null,
    errorMessage: sendResult.error ?? null,
  });

  return {
    ok: sendResult.ok,
    channel: resolved.channel,
    error: sendResult.error,
  };
}
