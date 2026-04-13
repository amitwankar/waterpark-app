import { cn } from "@/lib/utils";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

const badgeVariants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100",
  success: "bg-green-200 text-green-900 dark:bg-green-900/45 dark:text-green-100",
  warning: "bg-amber-200 text-amber-900 dark:bg-amber-900/45 dark:text-amber-100",
  danger: "bg-red-200 text-red-900 dark:bg-red-900/45 dark:text-red-100",
  info: "bg-cyan-200 text-cyan-900 dark:bg-cyan-900/45 dark:text-cyan-100",
};

export function Badge({ children, variant = "default", className }: BadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        badgeVariants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
