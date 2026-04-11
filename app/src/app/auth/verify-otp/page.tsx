"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { OtpInput } from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/Button";

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mobile = searchParams.get("mobile") ?? "";
  const redirect = searchParams.get("redirect") ?? "/guest/my-account";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleVerify() {
    if (otp.length !== 6) { setError("Enter the 6-digit OTP"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/v1/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setSuccess(true);
      router.replace(redirect);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true); setError(null);
    try {
      const res = await fetch("/api/v1/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      if (!res.ok) throw new Error("Failed to resend");
      setOtp("");
    } catch {
      setError("Could not resend OTP. Try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-full bg-teal-100 items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Enter OTP</h1>
          {mobile && (
            <p className="text-sm text-gray-500 mt-1">
              Sent to <span className="font-medium text-gray-700">+91 {mobile}</span>
            </p>
          )}
        </div>

        <div className="space-y-5">
          <OtpInput
            value={otp}
            onChange={setOtp}
            disabled={loading || success}
            error={error ?? undefined}
          />

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <Button
            onClick={handleVerify}
            loading={loading}
            disabled={otp.length !== 6 || success}
            className="w-full"
          >
            {success ? "Verified ✓" : "Verify OTP"}
          </Button>

          <div className="text-center">
            <p className="text-sm text-gray-500">
              Didn&apos;t receive?{" "}
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-teal-600 hover:underline font-medium disabled:opacity-50"
              >
                {resending ? "Resending…" : "Resend OTP"}
              </button>
            </p>
          </div>

          <div className="text-center">
            <a href="/login" className="text-sm text-gray-400 hover:text-gray-600">
              ← Back to login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
      </div>
    }>
      <VerifyOtpContent />
    </Suspense>
  );
}
