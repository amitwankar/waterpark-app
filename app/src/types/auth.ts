import { z } from "zod";

export type AuthRole = "ADMIN" | "EMPLOYEE" | "USER";
export type UserRole = "ADMIN" | "EMPLOYEE" | "USER";

export type EmployeeSubRole =
  | "TICKET_COUNTER"
  | "FB_STAFF"
  | "RIDE_OPERATOR"
  | "MAINTENANCE_TECH"
  | "LOCKER_ATTENDANT"
  | "COSTUME_ATTENDANT"
  | "PARKING_ATTENDANT"
  | "SALES_EXECUTIVE"
  | "SECURITY_STAFF"
  | "EVENT_COORDINATOR";

export const MOBILE_REGEX = /^[6-9]\d{9}$/;
export const OTP_REGEX = /^\d{6}$/;
export const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const mobileSchema = z
  .string()
  .trim()
  .regex(MOBILE_REGEX, "Enter a valid Indian mobile number");

export const otpSchema = z
  .string()
  .trim()
  .regex(OTP_REGEX, "OTP must be exactly 6 digits");

export const passwordSchema = z
  .string()
  .trim()
  .regex(
    PASSWORD_REGEX,
    "Password must be 8+ chars with uppercase, number, and special character",
  );

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be at most 100 characters");

export const emailSchema = z.string().trim().email("Invalid email").max(255).optional();

export const otpPurposeSchema = z.enum([
  "guest_login",
  "guest_register",
  "reset_password",
]);

export type OtpPurpose = z.infer<typeof otpPurposeSchema>;

export type AuthSessionFields = {
  id: string;
  userId: string;
  name: string;
  mobile: string;
  role: AuthRole;
  subRole: string | null;
  expiresAt: Date;
};

export function sanitizeMobile(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function sanitizeText(value: string, max = 255): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

export function sanitizeOptionalEmail(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const next = value.trim().toLowerCase();
  return next.length > 0 ? next.slice(0, 255) : undefined;
}

export function getPasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}
