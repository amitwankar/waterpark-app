"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { OtpInput } from "@/components/auth/OtpInput";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import {
  emailSchema,
  mobileSchema,
  nameSchema,
  passwordSchema,
  sanitizeMobile,
  sanitizeOptionalEmail,
  sanitizeText,
} from "@/types/auth";

type Errors = {
  name?: string;
  mobile?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  otp?: string;
  form?: string;
};

export default function RegisterPage(): JSX.Element {
  const router = useRouter();

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [step, setStep] = useState<"form" | "otp">("form");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const submitRegistration = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const cleanName = sanitizeText(name, 100);
    const cleanMobile = sanitizeMobile(mobile);
    const cleanEmail = sanitizeOptionalEmail(email);
    const cleanPassword = sanitizeText(password, 128);
    const cleanConfirm = sanitizeText(confirmPassword, 128);

    const nextErrors: Errors = {};

    const nameCheck = nameSchema.safeParse(cleanName);
    if (!nameCheck.success) {
      nextErrors.name = nameCheck.error.issues[0]?.message;
    }

    const mobileCheck = mobileSchema.safeParse(cleanMobile);
    if (!mobileCheck.success) {
      nextErrors.mobile = mobileCheck.error.issues[0]?.message;
    }

    if (cleanEmail) {
      const emailCheck = emailSchema.safeParse(cleanEmail);
      if (!emailCheck.success) {
        nextErrors.email = emailCheck.error.issues[0]?.message;
      }
    }

    const passwordCheck = passwordSchema.safeParse(cleanPassword);
    if (!passwordCheck.success) {
      nextErrors.password = passwordCheck.error.issues[0]?.message;
    }

    if (cleanPassword !== cleanConfirm) {
      nextErrors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const response = await fetch("/api/v1/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "guest_register",
          mobile: cleanMobile,
          name: cleanName,
          email: cleanEmail,
          password: cleanPassword,
        }),
      });

      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setErrors({ form: data?.message ?? "Unable to send OTP" });
        return;
      }

      setStep("otp");
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  const verifyRegistrationOtp = async (): Promise<void> => {
    const cleanMobile = sanitizeMobile(mobile);

    const nextErrors: Errors = {};
    const mobileCheck = mobileSchema.safeParse(cleanMobile);
    if (!mobileCheck.success) {
      nextErrors.mobile = mobileCheck.error.issues[0]?.message;
    }

    if (otp.length !== 6) {
      nextErrors.otp = "OTP must be 6 digits";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const response = await fetch("/api/v1/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "guest_register",
          mobile: cleanMobile,
          otp,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { message?: string; redirectTo?: string }
        | null;

      if (!response.ok) {
        setErrors({ form: data?.message ?? "OTP verification failed" });
        return;
      }

      router.push(data?.redirectTo ?? "/guest/my-account");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xl backdrop-blur">
      <h1 className="text-2xl font-semibold text-slate-900">Guest Registration</h1>
      <p className="mt-1 text-sm text-slate-600">Create account, verify OTP, and continue.</p>

      {step === "form" ? (
        <form onSubmit={submitRegistration} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              placeholder="Your name"
            />
            {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mobile</label>
            <input
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              inputMode="numeric"
              maxLength={10}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              placeholder="10-digit mobile"
            />
            {errors.mobile ? <p className="mt-1 text-xs text-red-600">{errors.mobile}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email (optional)</label>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              placeholder="name@example.com"
            />
            {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              placeholder="Set password"
            />
            <div className="mt-2">
              <PasswordStrength password={password} />
            </div>
            {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              placeholder="Re-enter password"
            />
            {errors.confirmPassword ? (
              <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>
            ) : null}
          </div>

          {errors.form ? <p className="text-sm text-red-600">{errors.form}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending OTP..." : "Continue"}
          </button>
        </form>
      ) : (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-slate-600">Enter the 6-digit OTP sent to {sanitizeMobile(mobile)}.</p>

          <OtpInput value={otp} onChange={setOtp} disabled={loading} error={errors.otp} />

          {errors.form ? <p className="text-sm text-red-600">{errors.form}</p> : null}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={verifyRegistrationOtp}
              className="flex-1 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => setStep("form")}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Edit details
            </button>
          </div>
        </div>
      )}

      <p className="mt-6 text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-cyan-700 hover:text-cyan-800">
          Sign in
        </Link>
      </p>
    </section>
  );
}