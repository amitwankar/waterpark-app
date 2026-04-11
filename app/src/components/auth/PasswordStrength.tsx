"use client";

import { PASSWORD_REGEX, getPasswordStrength } from "@/types/auth";

type PasswordStrengthProps = {
  password: string;
};

const labels = ["Very weak", "Weak", "Fair", "Strong", "Excellent"];

export function PasswordStrength({ password }: PasswordStrengthProps): JSX.Element {
  const score = getPasswordStrength(password);
  const valid = PASSWORD_REGEX.test(password);
  const width = `${(score / 4) * 100}%`;

  const color =
    score <= 1
      ? "bg-red-500"
      : score === 2
        ? "bg-amber-500"
        : score === 3
          ? "bg-lime-500"
          : "bg-emerald-600";

  return (
    <div className="space-y-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full transition-all ${color}`} style={{ width }} />
      </div>
      <p className="text-xs text-slate-600">
        Strength: {labels[score]}{valid ? "" : " (needs uppercase, number, special, 8+ chars)"}
      </p>
    </div>
  );
}