"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/Button";

export interface TagChipsProps {
  tags: string[];
  onRemove?: (tag: string) => void;
  onAdd?: (tag: string) => void;
  editable?: boolean;
}

export function TagChips({ tags, onRemove, onAdd, editable = false }: TagChipsProps): JSX.Element {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.length === 0 ? <span className="text-xs text-[var(--color-text-muted)]">No tags</span> : null}
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-1 text-xs"
          >
            {tag}
            {editable && onRemove ? (
              <button type="button" onClick={() => onRemove(tag)} className="rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </span>
        ))}
      </div>

      {editable && onAdd ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const input = form.elements.namedItem("tag") as HTMLInputElement | null;
            const value = input?.value.trim() ?? "";
            if (!value) return;
            onAdd(value);
            if (input) input.value = "";
          }}
        >
          <input
            name="tag"
            placeholder="Add tag"
            className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs outline-none focus:border-[var(--color-primary)]"
          />
          <Button type="submit" size="sm" variant="outline">
            Add
          </Button>
        </form>
      ) : null}
    </div>
  );
}
