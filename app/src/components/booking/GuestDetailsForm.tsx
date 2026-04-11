"use client";

import { Input } from "@/components/ui/Input";

export interface GuestDetailsValue {
  guestName: string;
  guestMobile: string;
  guestEmail: string;
  visitDate: string;
}

export interface GuestDetailsErrors {
  guestName?: string;
  guestMobile?: string;
  guestEmail?: string;
  visitDate?: string;
}

export interface GuestDetailsFormProps {
  value: GuestDetailsValue;
  errors?: GuestDetailsErrors;
  onChange: (next: GuestDetailsValue) => void;
  minVisitDate: string;
  maxVisitDate: string;
}

export function GuestDetailsForm({
  value,
  errors,
  onChange,
  minVisitDate,
  maxVisitDate,
}: GuestDetailsFormProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Input
        label="Guest Name"
        value={value.guestName}
        onChange={(event) => onChange({ ...value, guestName: event.target.value })}
        error={errors?.guestName}
        placeholder="Enter full name"
      />
      <Input
        label="Mobile Number"
        value={value.guestMobile}
        onChange={(event) =>
          onChange({
            ...value,
            guestMobile: event.target.value.replace(/\D/g, "").slice(0, 10),
          })
        }
        error={errors?.guestMobile}
        placeholder="10-digit mobile number"
      />
      <Input
        label="Email (Optional)"
        value={value.guestEmail}
        onChange={(event) => onChange({ ...value, guestEmail: event.target.value })}
        error={errors?.guestEmail}
        placeholder="name@example.com"
      />
      <Input
        label="Visit Date"
        type="date"
        min={minVisitDate}
        max={maxVisitDate}
        value={value.visitDate}
        onChange={(event) => onChange({ ...value, visitDate: event.target.value })}
        error={errors?.visitDate}
      />
    </div>
  );
}

