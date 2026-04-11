"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/utils";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className }: TooltipProps): JSX.Element {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="animate-fade-in-up pointer-events-none absolute left-1/2 top-full z-40 mt-2 -translate-x-1/2 rounded-[var(--radius-sm)] bg-zinc-900 px-2 py-1 text-xs text-white shadow-lg"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}