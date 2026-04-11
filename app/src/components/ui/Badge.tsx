import { cn } from "@/lib/utils";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

const badgeVariants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  success: "bg-green-100 text-green-700 dark:bg-green-900/35 dark:text-green-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/35 dark:text-amber-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-900/35 dark:text-red-300",
  info: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/35 dark:text-cyan-300",
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