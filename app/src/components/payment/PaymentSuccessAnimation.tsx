"use client";

export function PaymentSuccessAnimation(): JSX.Element {
  return (
    <div className="relative mx-auto h-24 w-24">
      <div className="absolute inset-0 animate-ping rounded-full bg-green-400/25" />
      <div className="absolute inset-2 flex items-center justify-center rounded-full bg-[var(--color-success)] text-white shadow-lg">
        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

