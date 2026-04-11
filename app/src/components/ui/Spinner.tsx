import { cn } from "@/lib/utils";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeStyles: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-[3px]",
};

export function Spinner({ size = "md", className }: SpinnerProps): JSX.Element {
  return (
    <span
      className={cn(
        "inline-block animate-spin rounded-full border-current border-t-transparent",
        sizeStyles[size],
        className,
      )}
      aria-hidden="true"
    />
  );
}
