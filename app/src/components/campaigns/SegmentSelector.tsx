"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export type SegmentType =
  | "ALL_GUESTS"
  | "TIER"
  | "TAG"
  | "INACTIVE"
  | "BIRTHDAY_MONTH"
  | "ANNIVERSARY_MONTH"
  | "LEAD_STAGE"
  | "LEAD_SOURCE"
  | "HIGH_SPENDERS"
  | "CUSTOM_MOBILE_LIST";

export interface SegmentSelectorProps {
  segmentType: SegmentType;
  filters: Record<string, unknown>;
  onChange: (segmentType: SegmentType, filters: Record<string, unknown>) => void;
}

export function SegmentSelector({ segmentType, filters, onChange }: SegmentSelectorProps): JSX.Element {
  return (
    <div className="space-y-3">
      <Select
        label="Segment Type"
        value={segmentType}
        onChange={(event) => onChange(event.target.value as SegmentType, {})}
        options={[
          { label: "All Guests", value: "ALL_GUESTS" },
          { label: "Tier", value: "TIER" },
          { label: "Tag", value: "TAG" },
          { label: "Inactive", value: "INACTIVE" },
          { label: "Birthday Month", value: "BIRTHDAY_MONTH" },
          { label: "Anniversary Month", value: "ANNIVERSARY_MONTH" },
          { label: "Lead Stage", value: "LEAD_STAGE" },
          { label: "Lead Source", value: "LEAD_SOURCE" },
          { label: "High Spenders", value: "HIGH_SPENDERS" },
          { label: "Custom Mobile List", value: "CUSTOM_MOBILE_LIST" },
        ]}
      />

      {segmentType === "TIER" ? (
        <Select
          label="Tier"
          value={String(filters.tier ?? "BRONZE")}
          onChange={(event) => onChange(segmentType, { ...filters, tier: event.target.value })}
          options={[
            { label: "BRONZE", value: "BRONZE" },
            { label: "SILVER", value: "SILVER" },
            { label: "GOLD", value: "GOLD" },
            { label: "PLATINUM", value: "PLATINUM" },
          ]}
        />
      ) : null}

      {segmentType === "TAG" ? (
        <Input
          label="Tag"
          value={String(filters.tag ?? "")}
          onChange={(event) => onChange(segmentType, { ...filters, tag: event.target.value })}
          placeholder="e.g. vip"
        />
      ) : null}

      {segmentType === "INACTIVE" ? (
        <Input
          label="Inactive Days"
          type="number"
          value={String(filters.inactiveDays ?? 90)}
          onChange={(event) => onChange(segmentType, { ...filters, inactiveDays: Number(event.target.value || "90") })}
        />
      ) : null}

      {segmentType === "BIRTHDAY_MONTH" || segmentType === "ANNIVERSARY_MONTH" ? (
        <Input
          label="Month (1-12)"
          type="number"
          min={1}
          max={12}
          value={String(filters.month ?? new Date().getMonth() + 1)}
          onChange={(event) => onChange(segmentType, { ...filters, month: Number(event.target.value || "1") })}
        />
      ) : null}

      {segmentType === "LEAD_STAGE" ? (
        <Select
          label="Lead Stage"
          value={String(filters.stage ?? "NEW")}
          onChange={(event) => onChange(segmentType, { ...filters, stage: event.target.value })}
          options={[
            { label: "NEW", value: "NEW" },
            { label: "CONTACTED", value: "CONTACTED" },
            { label: "INTERESTED", value: "INTERESTED" },
            { label: "PROPOSAL_SENT", value: "PROPOSAL_SENT" },
            { label: "BOOKED", value: "BOOKED" },
            { label: "LOST", value: "LOST" },
          ]}
        />
      ) : null}

      {segmentType === "LEAD_SOURCE" ? (
        <Select
          label="Lead Source"
          value={String(filters.source ?? "WEBSITE")}
          onChange={(event) => onChange(segmentType, { ...filters, source: event.target.value })}
          options={[
            { label: "WEBSITE", value: "WEBSITE" },
            { label: "WHATSAPP", value: "WHATSAPP" },
            { label: "PHONE", value: "PHONE" },
            { label: "WALKIN", value: "WALKIN" },
            { label: "SOCIAL", value: "SOCIAL" },
            { label: "REFERRAL", value: "REFERRAL" },
            { label: "EVENT", value: "EVENT" },
          ]}
        />
      ) : null}

      {segmentType === "HIGH_SPENDERS" ? (
        <Input
          label="Minimum Spend"
          type="number"
          min={0}
          value={String(filters.minSpend ?? 5000)}
          onChange={(event) => onChange(segmentType, { ...filters, minSpend: Number(event.target.value || "0") })}
        />
      ) : null}

      {segmentType === "CUSTOM_MOBILE_LIST" ? (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--color-text)]">Mobile List (comma/newline separated)</label>
          <textarea
            value={String(filters.mobileText ?? "")}
            onChange={(event) => {
              const mobileText = event.target.value;
              const mobiles = mobileText
                .split(/[\n,]/)
                .map((item) => item.trim())
                .filter(Boolean);
              onChange(segmentType, { mobileText, mobiles });
            }}
            className="h-28 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm outline-none"
          />
        </div>
      ) : null}
    </div>
  );
}
