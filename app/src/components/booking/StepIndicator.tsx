"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface StepIndicatorItem {
  id: number;
  title: string;
}

export interface StepIndicatorProps {
  steps: StepIndicatorItem[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((step, index) => {
        const complete = step.id < currentStep;
        const active = step.id === currentStep;

        return (
          <div key={step.id} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition duration-200",
                complete && "border-[var(--color-success)] bg-[var(--color-success)] text-white",
                active && "border-[var(--color-primary)] bg-[var(--color-primary)] text-white",
                !complete && !active && "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]",
              )}
            >
              {complete ? <Check className="h-4 w-4" /> : step.id}
            </div>
            <span className={cn("text-sm", active ? "font-semibold text-[var(--color-text)]" : "text-[var(--color-text-muted)]")}>
              {step.title}
            </span>
            {index < steps.length - 1 ? <span className="mx-1 h-px w-8 bg-[var(--color-border)]" /> : null}
          </div>
        );
      })}
    </div>
  );
}

