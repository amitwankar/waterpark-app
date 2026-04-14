"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AuditLogTable, type AuditLogRow } from "@/components/settings/AuditLogTable";
import { CapacitySettings } from "@/components/settings/CapacitySettings";
import { DepartmentMasterSettings } from "@/components/settings/DepartmentMasterSettings";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { HolidayCalendar, type HolidayItem } from "@/components/settings/HolidayCalendar";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { OperatingHoursGrid, type OperatingDayRow } from "@/components/settings/OperatingHoursGrid";
import { PaymentSettings } from "@/components/settings/PaymentSettings";
import { PricingSettings } from "@/components/settings/PricingSettings";
import { QueueSettings } from "@/components/settings/QueueSettings";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { UnsavedChangesGuard } from "@/components/settings/UnsavedChangesGuard";
import { UserManagement, type UserRow } from "@/components/settings/UserManagement";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";

interface SettingsPayload {
  parkName: string;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  timezone: string;
  defaultGstRate: number | string;
  foodGstRate: number | string;
  lockerGstRate: number | string;
  gstNumber: string | null;
  invoicePrefix: string;
  invoiceStartNumber: number;
  loyaltyEnabled: boolean;
  loyaltyPointsPerRupee: number | string;
  pointRedeemValue: number | string;
  maxRedeemPercent: number | string;
  pointsExpiryDays: number;
  razorpayEnabled: boolean;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  manualUpiEnabled: boolean;
  upiId: string | null;
  upiName: string | null;
  upiQrImageUrl: string | null;
  depositEnabled: boolean;
  depositPercent: number | string;
  depositLabel: string;
  splitEnabled: boolean;
  maxSplitMethods: number;
  minSplitAmount: number | string;
  refundDeductionPercent: number | string;
  maxCapacityPerDay: number;
  minDaysAhead: number;
  maxDaysAhead: number;
  bookingCutoffHour: number;
  maxTicketsPerBooking: number;
  queueLimitPerDay: number;
  queuePrefix: string;
  operatingHours: OperatingDayRow[];
  notifyBookingConfirm: boolean;
  notifyCheckin: boolean;
  notifyPaymentReceived: boolean;
  notifyRefund: boolean;
  notifyLoyaltyPoints: boolean;
  whatsappEnabled: boolean;
  whatsappApiKey: string;
  smsEnabled: boolean;
  smsApiKey: string;
}

const NAV_ITEMS = [
  { id: "general", label: "General" },
  { id: "pricing", label: "Pricing" },
  { id: "payment", label: "Payment" },
  { id: "capacity", label: "Capacity" },
  { id: "queue", label: "Queue" },
  { id: "operating-hours", label: "Operating Hours" },
  { id: "holidays", label: "Holidays" },
  { id: "notifications", label: "Notifications" },
  { id: "department-master", label: "Department Master" },
  { id: "users", label: "Users" },
  { id: "audit-log", label: "Audit Log" },
] as const;

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

export default function SettingsPage(): JSX.Element {
  const [activeId, setActiveId] = useState<string>("general");
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditLogRow[]>([]);
  const [dirtySections, setDirtySections] = useState<Record<string, boolean>>({});

  const hasUnsavedChanges = useMemo(
    () => Object.values(dirtySections).some(Boolean),
    [dirtySections],
  );

  useEffect(() => {
    void Promise.all([
      fetch("/api/v1/settings").then((res) => res.json()),
      fetch("/api/v1/settings/holidays").then((res) => res.json()),
      fetch("/api/v1/staff").then((res) => res.json()),
      fetch("/api/v1/settings/audit-log?page=1&pageSize=20").then((res) => res.json()),
    ]).then(([settingsPayload, holidayRows, staffRows, auditPayload]) => {
      setSettings(settingsPayload as SettingsPayload);
      setHolidays(holidayRows as HolidayItem[]);

      const staffUsers = (staffRows as Array<{ id: string; name: string; mobile: string; email: string | null; subRole: string | null; isActive: boolean }>).map(
        (row) => ({
          id: row.id,
          name: row.name,
          mobile: row.mobile,
          email: row.email,
          role: "EMPLOYEE",
          subRole: row.subRole,
          isActive: row.isActive,
        }),
      );
      setUsers(staffUsers);
      setAuditRows((auditPayload?.rows ?? []) as AuditLogRow[]);
    });
  }, []);

  const markDirty = useCallback((section: string, dirty: boolean): void => {
    setDirtySections((prev) => {
      if (prev[section] === dirty) return prev;
      return { ...prev, [section]: dirty };
    });
  }, []);

  const dirtyHandlers = useMemo(
    () => ({
      general: (dirty: boolean) => markDirty("general", dirty),
      pricing: (dirty: boolean) => markDirty("pricing", dirty),
      payment: (dirty: boolean) => markDirty("payment", dirty),
      capacity: (dirty: boolean) => markDirty("capacity", dirty),
      queue: (dirty: boolean) => markDirty("queue", dirty),
      operatingHours: (dirty: boolean) => markDirty("operating-hours", dirty),
      notifications: (dirty: boolean) => markDirty("notifications", dirty),
    }),
    [markDirty],
  );

  function handleSaved(next: Record<string, unknown>): void {
    setSettings(next as unknown as SettingsPayload);
  }

  if (!settings) {
    return <div className="p-6 text-sm text-[var(--color-text-muted)]">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <UnsavedChangesGuard enabled={hasUnsavedChanges} />

      <PageHeader
        title="Settings"
        subtitle="Manage configuration, rules and controls"
        actions={[
          {
            key: "status",
            element: hasUnsavedChanges ? <Badge variant="warning">Unsaved changes</Badge> : <Badge variant="success">All changes saved</Badge>,
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="self-start">
          <SettingsNav
            items={NAV_ITEMS.map((item) => ({ ...item }))}
            activeId={activeId}
            onSelect={(id) => {
              setActiveId(id);
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        </div>

        <div className="space-y-6">
          <GeneralSettings
            initialValue={{
              parkName: settings.parkName,
              logoUrl: settings.logoUrl ?? "",
              phone: settings.phone ?? "",
              email: settings.email ?? "",
              websiteUrl: settings.websiteUrl ?? "",
              address: settings.address ?? "",
              city: settings.city ?? "",
              state: settings.state ?? "",
              pincode: settings.pincode ?? "",
              timezone: settings.timezone,
            }}
            onSaved={handleSaved}
            onDirtyChange={dirtyHandlers.general}
          />

          <PricingSettings
            initialValue={{
              defaultGstRate: toNumber(settings.defaultGstRate),
              foodGstRate: toNumber(settings.foodGstRate),
              lockerGstRate: toNumber(settings.lockerGstRate),
              gstNumber: settings.gstNumber ?? "",
              invoicePrefix: settings.invoicePrefix,
              invoiceStartNumber: settings.invoiceStartNumber,
              loyaltyEnabled: settings.loyaltyEnabled,
              pointsPerRupee: toNumber(settings.loyaltyPointsPerRupee),
              pointRedeemValue: toNumber(settings.pointRedeemValue),
              maxRedeemPercent: toNumber(settings.maxRedeemPercent),
              pointsExpiryDays: settings.pointsExpiryDays,
            }}
            onSaved={handleSaved}
            onDirtyChange={dirtyHandlers.pricing}
          />

          <PaymentSettings
            initialValue={{
              razorpayEnabled: settings.razorpayEnabled,
              razorpayKeyId: settings.razorpayKeyId ?? "",
              razorpayKeySecret: settings.razorpayKeySecret ?? "",
              manualUpiEnabled: settings.manualUpiEnabled,
              upiId: settings.upiId ?? "",
              upiName: settings.upiName ?? "",
              upiQrImageUrl: settings.upiQrImageUrl ?? "",
              depositEnabled: settings.depositEnabled,
              depositPercent: toNumber(settings.depositPercent),
              depositLabel: settings.depositLabel,
              splitEnabled: settings.splitEnabled,
              maxSplitMethods: settings.maxSplitMethods,
              minSplitAmount: toNumber(settings.minSplitAmount),
              refundDeductionPercent: toNumber(settings.refundDeductionPercent),
            }}
            onSaved={handleSaved}
            onDirtyChange={dirtyHandlers.payment}
          />

          <CapacitySettings
            initialValue={{
              maxCapacityPerDay: settings.maxCapacityPerDay,
              minDaysAhead: settings.minDaysAhead,
              maxDaysAhead: settings.maxDaysAhead,
              bookingCutoffHour: settings.bookingCutoffHour,
              maxTicketsPerBooking: settings.maxTicketsPerBooking,
            }}
            onSaved={handleSaved}
            onDirtyChange={dirtyHandlers.capacity}
          />

          <QueueSettings
            initialValue={{
              queueLimitPerDay: settings.queueLimitPerDay ?? 0,
              queuePrefix: settings.queuePrefix ?? "Q",
            }}
            onSaved={handleSaved}
            onDirtyChange={dirtyHandlers.queue}
          />

          <OperatingHoursGrid
            value={settings.operatingHours}
            onSaved={handleSaved}
            onDirtyChange={dirtyHandlers.operatingHours}
          />

          <HolidayCalendar initialHolidays={holidays} />

          <NotificationSettings
            initialValue={{
              notifyBookingConfirm: settings.notifyBookingConfirm,
              notifyCheckin: settings.notifyCheckin,
              notifyPaymentReceived: settings.notifyPaymentReceived,
              notifyRefund: settings.notifyRefund,
              notifyLoyaltyPoints: settings.notifyLoyaltyPoints,
              whatsappEnabled: settings.whatsappEnabled,
              whatsappApiKey: settings.whatsappApiKey ?? "",
              smsEnabled: settings.smsEnabled,
              smsApiKey: settings.smsApiKey ?? "",
            }}
            onSaved={handleSaved}
            onDirtyChange={dirtyHandlers.notifications}
          />

          <DepartmentMasterSettings />

          <UserManagement initialUsers={users} />

          <AuditLogTable initialRows={auditRows} />
        </div>
      </div>
    </div>
  );
}
