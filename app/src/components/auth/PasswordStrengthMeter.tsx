"use client";

import { useEffect, useRef, useState } from "react";

interface PasswordStrengthMeterProps {
  valueResolver?: (password: string) => number;
}

function widthClass(score: number): string {
  if (score <= 0) return "w-0";
  if (score === 1) return "w-1/5";
  if (score === 2) return "w-2/5";
  if (score === 3) return "w-3/5";
  if (score === 4) return "w-4/5";
  return "w-full";
}

export function PasswordStrengthMeter({ valueResolver }: PasswordStrengthMeterProps): JSX.Element {
  const [password, setPassword] = useState("");
  const [score, setScore] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const handler = () => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && active.name === "password") {
        const value = active.value;
        setPassword(value);
        if (valueResolver) {
          setScore(valueResolver(value));
        } else {
          let next = 0;
          if (value.length >= 8) next += 1;
          if (/[A-Z]/.test(value)) next += 1;
          if (/[a-z]/.test(value)) next += 1;
          if (/\d/.test(value)) next += 1;
          if (/[^A-Za-z0-9]/.test(value)) next += 1;
          setScore(next);
        }
      }
    };

    intervalRef.current = window.setInterval(handler, 250);
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [valueResolver]);

  const label = score <= 2 ? "Weak" : score <= 4 ? "Medium" : "Strong";

  return (
    <div className="space-y-1">
      <div className="h-2 w-full rounded-full bg-zinc-200">
        <div
          className={`h-2 rounded-full transition-all ${widthClass(score)} ${
            score <= 2 ? "bg-red-500" : score <= 4 ? "bg-amber-500" : "bg-emerald-500"
          }`}
        />
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">
        Strength: {password.length === 0 ? "-" : label}
      </p>
    </div>
  );
}
