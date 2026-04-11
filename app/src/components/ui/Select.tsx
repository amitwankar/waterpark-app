import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helper?: string;
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
}

export function Select({
  label,
  error,
  helper,
  options,
  placeholder,
  className,
  id,
  ...props
}: SelectProps): JSX.Element {
  const selectId = id ?? props.name;

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={selectId} className="text-sm font-medium text-[var(--color-text)]">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            "h-10 w-full appearance-none rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-3 pr-10 text-sm text-[var(--color-text)] transition duration-150 outline-none",
            error
              ? "border-red-500"
              : "border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20",
            className,
          )}
          {...props}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
      </div>
      {error ? <p className="text-xs text-red-500">{error}</p> : helper ? <p className="text-xs text-[var(--color-text-muted)]">{helper}</p> : null}
    </div>
  );
}