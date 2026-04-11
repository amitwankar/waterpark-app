import { cn } from "@/lib/utils";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  label?: string;
  error?: string;
  helper?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export function Input({ label, error, helper, prefix, suffix, className, id, ...props }: InputProps): JSX.Element {
  const inputId = id ?? props.name;

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-[var(--color-text)]">
          {label}
        </label>
      ) : null}
      <div
        className={cn(
          "flex h-10 items-center rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-3",
          error ? "border-red-500" : "border-[var(--color-border)]",
          "focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20",
        )}
      >
        {prefix ? <span className="mr-2 text-[var(--color-text-muted)]">{prefix}</span> : null}
        <input
          id={inputId}
          className={cn(
            "h-full w-full border-none bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]",
            className,
          )}
          {...props}
        />
        {suffix ? <span className="ml-2 text-[var(--color-text-muted)]">{suffix}</span> : null}
      </div>
      {error ? <p className="text-xs text-red-500">{error}</p> : helper ? <p className="text-xs text-[var(--color-text-muted)]">{helper}</p> : null}
    </div>
  );
}
