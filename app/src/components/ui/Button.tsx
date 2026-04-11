import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]",
  secondary: "bg-[var(--color-secondary)] text-white hover:bg-amber-600",
  outline: "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-zinc-100 dark:hover:bg-zinc-800",
  ghost: "bg-transparent text-[var(--color-text)] hover:bg-zinc-100 dark:hover:bg-zinc-800",
  danger: "bg-[var(--color-danger)] text-white hover:bg-red-600",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  icon: Icon,
  disabled,
  children,
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 disabled:cursor-not-allowed disabled:opacity-60",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner size="sm" className="text-current" /> : null}
      {!loading && Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}
