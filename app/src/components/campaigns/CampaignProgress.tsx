export interface CampaignProgressProps {
  targetCount: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
}

export function CampaignProgress({
  targetCount,
  sentCount,
  deliveredCount,
  failedCount,
}: CampaignProgressProps): JSX.Element {
  const progress = targetCount > 0 ? Math.min(100, Math.round((sentCount / targetCount) * 100)) : 0;
  const bucket = Math.min(10, Math.max(0, Math.ceil(progress / 10)));
  const widthClass =
    bucket === 0
      ? "w-0"
      : bucket === 1
        ? "w-[10%]"
        : bucket === 2
          ? "w-[20%]"
          : bucket === 3
            ? "w-[30%]"
            : bucket === 4
              ? "w-[40%]"
              : bucket === 5
                ? "w-[50%]"
                : bucket === 6
                  ? "w-[60%]"
                  : bucket === 7
                    ? "w-[70%]"
                    : bucket === 8
                      ? "w-[80%]"
                      : bucket === 9
                        ? "w-[90%]"
                        : "w-full";

  return (
    <div className="space-y-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className={`h-full bg-[var(--color-primary)] transition-all duration-300 ${widthClass}`} />
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-muted)]">
        <span>Target: {targetCount}</span>
        <span>Sent: {sentCount}</span>
        <span>Delivered: {deliveredCount}</span>
        <span>Failed: {failedCount}</span>
        <span>{progress}%</span>
      </div>
    </div>
  );
}
