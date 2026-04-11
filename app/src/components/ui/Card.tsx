import { cn } from "@/lib/utils";

export interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export interface CardSectionProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className, children }: CardProps): JSX.Element {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({ className, children }: CardSectionProps): JSX.Element {
  return <header className={cn("border-b border-[var(--color-border)] p-4", className)}>{children}</header>;
}

export function CardBody({ className, children }: CardSectionProps): JSX.Element {
  return <div className={cn("p-4", className)}>{children}</div>;
}

export function CardFooter({ className, children }: CardSectionProps): JSX.Element {
  return <footer className={cn("border-t border-[var(--color-border)] p-4", className)}>{children}</footer>;
}