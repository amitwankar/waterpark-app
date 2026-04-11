"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export type IdProofType = "AADHAAR" | "DRIVING_LICENSE" | "PAN" | "PASSPORT" | "VOTER_ID" | "OTHER";

export interface Step1GuestDetailsValue {
  guestName: string;
  guestMobile: string;
  guestEmail: string;
  visitDate: string;
  idProofType?: IdProofType;
  idProofNumber?: string;
  idProofLabel?: string;
}

export interface Step1GuestDetailsErrors {
  guestName?: string;
  guestMobile?: string;
  guestEmail?: string;
  visitDate?: string;
  idProofType?: string;
  idProofNumber?: string;
  idProofLabel?: string;
}

export interface Step1GuestDetailsProps {
  value: Step1GuestDetailsValue;
  errors?: Step1GuestDetailsErrors;
  onChange: (patch: Partial<Step1GuestDetailsValue>) => void;
  minVisitDate: string;
  maxVisitDate: string;
  idProofRequired: boolean;
}

const idProofOptions: Array<{ label: string; value: IdProofType }> = [
  { label: "Aadhaar", value: "AADHAAR" },
  { label: "Driving Licence", value: "DRIVING_LICENSE" },
  { label: "PAN", value: "PAN" },
  { label: "Passport", value: "PASSPORT" },
  { label: "Voter ID", value: "VOTER_ID" },
  { label: "Other", value: "OTHER" },
];

function proofPlaceholder(type?: IdProofType): string {
  if (type === "AADHAAR") return "e.g. 123412341234";
  if (type === "DRIVING_LICENSE") return "e.g. MH1420110012345";
  if (type === "PAN") return "e.g. ABCDE1234F";
  if (type === "PASSPORT") return "e.g. Z1234567";
  if (type === "VOTER_ID") return "e.g. ABC1234567";
  return "Enter ID number";
}

export function Step1GuestDetails({
  value,
  errors,
  onChange,
  minVisitDate,
  maxVisitDate,
  idProofRequired,
}: Step1GuestDetailsProps): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Guest Name"
          value={value.guestName}
          onChange={(event) => onChange({ guestName: event.target.value })}
          error={errors?.guestName}
          placeholder="Enter full name"
        />
        <Input
          label="Mobile Number"
          value={value.guestMobile}
          onChange={(event) =>
            onChange({
              guestMobile: event.target.value.replace(/\D/g, "").slice(0, 10),
            })
          }
          error={errors?.guestMobile}
          placeholder="10-digit mobile number"
        />
        <Input
          label="Email (Optional)"
          value={value.guestEmail}
          onChange={(event) => onChange({ guestEmail: event.target.value })}
          error={errors?.guestEmail}
          placeholder="name@example.com"
        />
        <Input
          label="Visit Date"
          type="date"
          min={minVisitDate}
          max={maxVisitDate}
          value={value.visitDate}
          onChange={(event) => onChange({ visitDate: event.target.value })}
          error={errors?.visitDate}
        />
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Primary Person ID Proof</h3>
          {idProofRequired ? <span className="text-xs font-semibold text-red-500">Required</span> : <span className="text-xs text-[var(--color-text-muted)]">Optional</span>}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Select
            label="ID Type"
            value={value.idProofType ?? ""}
            onChange={(event) =>
              onChange({
                idProofType: (event.target.value || undefined) as IdProofType | undefined,
              })
            }
            options={idProofOptions}
            placeholder="Select ID type"
            error={errors?.idProofType}
          />

          <Input
            label="ID Number"
            value={value.idProofNumber ?? ""}
            onChange={(event) => onChange({ idProofNumber: event.target.value })}
            placeholder={proofPlaceholder(value.idProofType)}
            error={errors?.idProofNumber}
          />

          {value.idProofType === "OTHER" ? (
            <Input
              label="ID Label"
              value={value.idProofLabel ?? ""}
              onChange={(event) => onChange({ idProofLabel: event.target.value })}
              placeholder="e.g. Employee Card"
              error={errors?.idProofLabel}
            />
          ) : null}
        </div>

        <p className="mt-3 text-xs text-[var(--color-text-muted)]">Your ID is encrypted and stored securely.</p>
      </div>
    </div>
  );
}
