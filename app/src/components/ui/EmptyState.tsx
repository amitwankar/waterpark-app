import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, message, action, className }: EmptyStateProps): JSX.Element {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] p-8 text-center", className)}>
      <div className="mb-3 rounded-full bg-[var(--color-primary-light)] p-3 text-[var(--color-primary)]">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold text-[var(--color-text)]">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-[var(--color-text-muted)]">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}