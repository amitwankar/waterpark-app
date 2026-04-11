"use client";

import { cn } from "@/lib/utils";

export interface SettingsNavItem {
  id: string;
  label: string;
}

export interface SettingsNavProps {
  items: SettingsNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function SettingsNav({ items, activeId, onSelect }: SettingsNavProps): JSX.Element {
  return (
    <aside className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
      <nav className="space-y-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              "w-full rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-medium transition duration-150",
              activeId === item.id
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--color-text-muted)] hover:bg-zinc-100 hover:text-[var(--color-text)] dark:hover:bg-zinc-800",
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
