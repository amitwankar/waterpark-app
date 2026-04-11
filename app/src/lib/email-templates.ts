export interface InviteEmailInput {
  email: string;
  name: string;
  setPasswordUrl: string;
}

export interface MagicLinkEmailInput {
  email: string;
  url: string;
}

export interface PasswordResetEmailInput {
  email: string;
  resetUrl: string;
}

export interface BookingConfirmationEmailInput {
  email: string;
  name: string;
  bookingNumber: string;
  visitDate: string;
  qrLink: string;
  ticketLines?: Array<{ name: string; quantity: number; unitPrice: number }>;
  totalAmount?: number;
}

export interface OtpEmailInput {
  email: string;
  name?: string;
  otp: string;
}

function wrapEmail(title: string, body: string): string {
  return `
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;padding:24px;">
        <h1 style="margin:0 0 16px;font-size:22px;color:#0f766e;">${title}</h1>
        ${body}
        <p style="margin-top:24px;color:#71717a;font-size:12px;">AquaWorld Park</p>
      </div>
    </div>
  `;
}

function ctaButton(label: string, url: string): string {
  return `
    <a href="${url}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
      ${label}
    </a>
  `;
}

export function inviteEmailTemplate(input: InviteEmailInput): { subject: string; html: string; text: string } {
  const subject = "You are invited to AquaWorld staff portal";
  const html = wrapEmail(
    "Set your password",
    `<p>Hi ${input.name},</p>
     <p>You were invited to the AquaWorld staff portal. Use the button below to set your password.</p>
     ${ctaButton("Set Password", input.setPasswordUrl)}
     <p style="margin-top:16px;color:#71717a;">If you did not expect this invite, ignore this email.</p>`,
  );

  return {
    subject,
    html,
    text: `Hi ${input.name}, set your password: ${input.setPasswordUrl}`,
  };
}

export function magicLinkEmailTemplate(input: MagicLinkEmailInput): { subject: string; html: string; text: string } {
  const subject = "Your AquaWorld login link";
  const html = wrapEmail(
    "Passwordless sign-in",
    `<p>Use this secure link to sign in to AquaWorld.</p>
     ${ctaButton("Log in to AquaWorld", input.url)}
     <p style="margin-top:16px;color:#71717a;">This link expires shortly and can be used only once.</p>`,
  );

  return {
    subject,
    html,
    text: `Your login link: ${input.url}`,
  };
}

export function passwordResetEmailTemplate(input: PasswordResetEmailInput): { subject: string; html: string; text: string } {
  const subject = "Reset your AquaWorld password";
  const html = wrapEmail(
    "Password reset",
    `<p>We received a request to reset your password.</p>
     ${ctaButton("Reset Password", input.resetUrl)}
     <p style="margin-top:16px;color:#71717a;">Expires in 1 hour. If you did not request this, you can ignore this email.</p>`,
  );

  return {
    subject,
    html,
    text: `Reset your password: ${input.resetUrl}. Expires in 1 hour.`,
  };
}

export function bookingConfirmationEmailTemplate(input: BookingConfirmationEmailInput): { subject: string; html: string; text: string } {
  const subject = `Booking confirmed — ${input.bookingNumber}`;

  const ticketRows = (input.ticketLines ?? [])
    .map(
      (line) =>
        `<tr>
          <td style="padding:4px 8px;border-bottom:1px solid #f4f4f5;">${line.name}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #f4f4f5;text-align:center;">${line.quantity}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #f4f4f5;text-align:right;">₹${(line.unitPrice * line.quantity).toFixed(2)}</td>
        </tr>`,
    )
    .join("");

  const ticketTable =
    ticketRows.length > 0
      ? `<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;">
           <thead>
             <tr style="background:#f4f4f5;">
               <th style="padding:6px 8px;text-align:left;">Ticket</th>
               <th style="padding:6px 8px;text-align:center;">Qty</th>
               <th style="padding:6px 8px;text-align:right;">Amount</th>
             </tr>
           </thead>
           <tbody>${ticketRows}</tbody>
           ${
             input.totalAmount !== undefined
               ? `<tfoot>
                    <tr>
                      <td colspan="2" style="padding:6px 8px;font-weight:700;">Total</td>
                      <td style="padding:6px 8px;text-align:right;font-weight:700;">₹${input.totalAmount.toFixed(2)}</td>
                    </tr>
                  </tfoot>`
               : ""
           }
         </table>`
      : "";

  const html = wrapEmail(
    "Booking Confirmed",
    `<p>Hi ${input.name}, your booking is confirmed!</p>
     <p style="margin:12px 0;">
       <strong>Booking #:</strong> ${input.bookingNumber}<br/>
       <strong>Visit Date:</strong> ${input.visitDate}
     </p>
     ${ticketTable}
     <p style="margin:16px 0 8px;">Show the QR code below at the gate for entry:</p>
     ${ctaButton("View Ticket & QR", input.qrLink)}
     <p style="margin-top:16px;color:#71717a;font-size:12px;">
       You can also access your ticket anytime from the link above.<br/>
       We look forward to seeing you!
     </p>`,
  );

  const textLines = [
    `Hi ${input.name}, your booking is confirmed!`,
    `Booking #: ${input.bookingNumber}`,
    `Visit Date: ${input.visitDate}`,
    ...(input.ticketLines ?? []).map((l) => `  ${l.name} × ${l.quantity} — ₹${(l.unitPrice * l.quantity).toFixed(2)}`),
    input.totalAmount !== undefined ? `Total: ₹${input.totalAmount.toFixed(2)}` : "",
    ``,
    `View your QR ticket: ${input.qrLink}`,
  ].filter(Boolean);

  return {
    subject,
    html,
    text: textLines.join("\n"),
  };
}

export function otpEmailTemplate(input: OtpEmailInput): { subject: string; html: string; text: string } {
  const subject = "Your AquaWorld OTP";
  const html = wrapEmail(
    "OTP verification",
    `<p>${input.name ? `Hi ${input.name},` : "Hi,"} your OTP is:</p>
     <p style="font-size:28px;letter-spacing:6px;font-weight:700;color:#0f766e;">${input.otp}</p>
     <p style="color:#71717a;">Valid for 5 minutes.</p>`,
  );

  return {
    subject,
    html,
    text: `Your AquaWorld OTP is ${input.otp}. Valid for 5 minutes.`,
  };
}
