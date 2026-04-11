import nodemailer, { type Transporter } from "nodemailer";

import {
  bookingConfirmationEmailTemplate,
  inviteEmailTemplate,
  magicLinkEmailTemplate,
  otpEmailTemplate,
  passwordResetEmailTemplate,
  type BookingConfirmationEmailInput,
  type InviteEmailInput,
  type MagicLinkEmailInput,
  type OtpEmailInput,
  type PasswordResetEmailInput,
} from "@/lib/email-templates";

let transporterPromise: Promise<Transporter> | null = null;

async function createTransporter(): Promise<Transporter> {
  const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);

  if (hasSmtp) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  const account = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: {
      user: account.user,
      pass: account.pass,
    },
  });
}

async function getTransporter(): Promise<Transporter> {
  if (!transporterPromise) {
    transporterPromise = createTransporter();
  }
  return transporterPromise;
}

export async function sendMail(input: { to: string; subject: string; html: string; text?: string }): Promise<void> {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: `${process.env.SMTP_FROM_NAME ?? "AquaWorld"} <${process.env.SMTP_FROM_EMAIL ?? "no-reply@aquaworld.local"}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (process.env.NODE_ENV !== "production") {
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) {
      console.log("[mailer] preview", preview);
    }
  }
}

export async function sendInviteEmail(input: InviteEmailInput): Promise<void> {
  const tpl = inviteEmailTemplate(input);
  await sendMail({ to: input.email, ...tpl });
}

export async function sendMagicLinkEmail(input: MagicLinkEmailInput): Promise<void> {
  const tpl = magicLinkEmailTemplate(input);
  await sendMail({ to: input.email, ...tpl });
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
  const tpl = passwordResetEmailTemplate(input);
  await sendMail({ to: input.email, ...tpl });
}

export async function sendBookingConfirmationEmail(input: BookingConfirmationEmailInput): Promise<void> {
  const tpl = bookingConfirmationEmailTemplate(input);
  await sendMail({ to: input.email, ...tpl });
}

export async function sendOtpEmail(input: OtpEmailInput): Promise<void> {
  const tpl = otpEmailTemplate(input);
  await sendMail({ to: input.email, ...tpl });
}

// Supported SMTP examples:
// Gmail: host=smtp.gmail.com port=465 secure=true (App Password required)
// Zoho: host=smtp.zoho.in port=465 secure=true
// SendGrid: host=smtp.sendgrid.net port=587 secure=false
// Mailgun: host=smtp.mailgun.org port=587 secure=false
// Custom SMTP: provide your own SMTP_HOST/PORT/USER/PASS
