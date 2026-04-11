"use client";

import { useEffect, useRef } from "react";

interface OtpInputGridProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function OtpInputGrid({ value, onChange, disabled }: OtpInputGridProps): JSX.Element {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? "");

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  return (
    <div className="flex justify-between gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(event) => {
            const nextDigit = event.target.value.replace(/\D/g, "").slice(0, 1);
            const next = value.split("");
            next[index] = nextDigit;
            onChange(next.join("").slice(0, 6));
            if (nextDigit && index < 5) {
              refs.current[index + 1]?.focus();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digit && index > 0) {
              refs.current[index - 1]?.focus();
            }
          }}
          className="h-12 w-12 rounded-lg border border-[var(--color-border)] text-center text-lg font-semibold outline-none ring-[var(--color-primary)]/30 focus:ring-2"
        />
      ))}
    </div>
  );
}
