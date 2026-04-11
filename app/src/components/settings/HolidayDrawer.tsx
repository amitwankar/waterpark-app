"use client";

import { useEffect, useState, useTransition } from "react";

import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export type HolidayType = "CLOSED" | "SPECIAL_HOURS" | "SPECIAL_EVENT";

export interface HolidayItem {
  id: string;
  date: string;
  name: string;
  type: HolidayType;
  specialOpenTime?: string | null;
  specialCloseTime?: string | null;
  message?: string | null;
}

export interface HolidayDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedDate: string;
  holiday?: HolidayItem | null;
  onSaved: () => void;
}

export function HolidayDrawer({ open, onClose, selectedDate, holiday, onSaved }: HolidayDrawerProps): JSX.Element {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [type, setType] = useState<HolidayType>("CLOSED");
  const [specialOpenTime, setSpecialOpenTime] = useState("");
  const [specialCloseTime, setSpecialCloseTime] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setName(holiday?.name ?? "");
    setType(holiday?.type ?? "CLOSED");
    setSpecialOpenTime(holiday?.specialOpenTime ?? "");
    setSpecialCloseTime(holiday?.specialCloseTime ?? "");
    setMessage(holiday?.message ?? "");
  }, [holiday]);

  return (
    <Drawer open={open} onClose={onClose} title={holiday ? "Edit Holiday" : "Add Holiday"}>
      <div className="space-y-4">
        <Input label="Date" type="date" value={selectedDate} readOnly />
        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <Select
          label="Type"
          value={type}
          onChange={(event) => setType(event.target.value as HolidayType)}
          options={[
            { label: "Closed", value: "CLOSED" },
            { label: "Special Hours", value: "SPECIAL_HOURS" },
            { label: "Special Event", value: "SPECIAL_EVENT" },
          ]}
        />

        {type === "SPECIAL_HOURS" ? (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Open time" type="time" value={specialOpenTime} onChange={(event) => setSpecialOpenTime(event.target.value)} />
            <Input label="Close time" type="time" value={specialCloseTime} onChange={(event) => setSpecialCloseTime(event.target.value)} />
          </div>
        ) : null}

        <div className="space-y-1">
          <label className="text-sm font-medium text-[var(--color-text)]">Message</label>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="h-24 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <Button
            loading={isPending}
            onClick={() => {
              startTransition(() => {
                const method = holiday ? "PUT" : "POST";
                const url = holiday ? `/api/v1/settings/holidays/${holiday.id}` : "/api/v1/settings/holidays";
                void fetch(url, {
                  method,
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    date: selectedDate,
                    name,
                    type,
                    specialOpenTime,
                    specialCloseTime,
                    message,
                  }),
                }).then(() => {
                  onSaved();
                  onClose();
                });
              });
            }}
          >
            Save Holiday
          </Button>

          {holiday ? (
            <Button
              variant="danger"
              loading={isPending}
              onClick={() => {
                startTransition(() => {
                  void fetch(`/api/v1/settings/holidays/${holiday.id}`, {
                    method: "DELETE",
                  }).then(() => {
                    onSaved();
                    onClose();
                  });
                });
              }}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </div>
    </Drawer>
  );
}
