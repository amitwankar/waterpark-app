import { cn } from "@/lib/utils";

export interface PageHeaderAction {
  key: string;
  element: React.ReactNode;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: PageHeaderAction[];
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps): JSX.Element {
  return (
    <div className={cn("flex flex-col gap-3 md:flex-row md:items-center md:justify-between", className)}>
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p> : null}
      </div>
      {actions?.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action) => (
            <div key={action.key}>{action.element}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}