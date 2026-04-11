import { cn } from "@/lib/utils";

export interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps): JSX.Element {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-md bg-linear-to-r from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800",
        className,
      )}
      style={style}
      aria-hidden="true"
    />
  );
}
