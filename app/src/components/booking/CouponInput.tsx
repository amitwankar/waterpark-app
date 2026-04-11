"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export interface CouponInputProps {
  value: string;
  onChange: (value: string) => void;
  onApply?: () => void;
  loading?: boolean;
  error?: string;
}

export function CouponInput({ value, onChange, onApply, loading, error }: CouponInputProps): JSX.Element {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          label="Coupon Code"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          placeholder="e.g. WELCOME10"
          className="uppercase"
          error={error}
        />
        <Button
          type="button"
          variant="outline"
          className="mt-7 shrink-0"
          onClick={onApply}
          loading={loading}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

