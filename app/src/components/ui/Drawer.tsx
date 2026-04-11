"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

export interface DrawerProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClassName?: string;
}

export function Drawer({
  open,
  title,
  onClose,
  children,
  widthClassName = "w-full max-w-md",
}: DrawerProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-slide-in-right h-full border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-modal)]",
          widthClassName,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
          <h2 className="text-base font-semibold text-[var(--color-text)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-sm)] p-1 text-[var(--color-text-muted)] transition hover:bg-zinc-100 hover:text-[var(--color-text)] dark:hover:bg-zinc-800"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-[calc(100%-56px)] overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
}