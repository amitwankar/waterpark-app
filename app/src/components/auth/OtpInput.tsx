"use client";

import { useEffect, useMemo, useRef } from "react";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
};

const OTP_LENGTH = 6;

export function OtpInput({ value, onChange, disabled, error }: OtpInputProps): JSX.Element {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const digits = useMemo(() => {
    const normalized = value.replace(/\D/g, "").slice(0, OTP_LENGTH);
    return Array.from({ length: OTP_LENGTH }, (_, index) => normalized[index] ?? "");
  }, [value]);

  useEffect(() => {
    if (value.length === OTP_LENGTH) {
      refs.current[OTP_LENGTH - 1]?.blur();
    }
  }, [value]);

  const setDigit = (index: number, next: string): void => {
    const single = next.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = single;
    const joined = newDigits.join("").replace(/\s/g, "").slice(0, OTP_LENGTH);
    onChange(joined);

    if (single && index < OTP_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const onKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              refs.current[index] = node;
            }}
            value={digit}
            disabled={disabled}
            inputMode="numeric"
            autoComplete="one-time-code"
            onKeyDown={(event) => onKeyDown(index, event)}
            onChange={(event) => setDigit(index, event.target.value)}
            className="h-12 w-11 rounded-lg border border-slate-300 bg-white text-center text-lg font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
        ))}
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}