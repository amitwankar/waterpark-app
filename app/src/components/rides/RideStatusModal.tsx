"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";

export interface RideStatusModalProps {
  open: boolean;
  onClose: () => void;
  rideId: string;
  currentStatus: "ACTIVE" | "MAINTENANCE" | "CLOSED" | "SEASONAL";
  onUpdated?: () => void;
}

export function RideStatusModal({ open, onClose, rideId, currentStatus, onUpdated }: RideStatusModalProps): JSX.Element {
  const [status, setStatus] = useState<RideStatusModalProps["currentStatus"]>(currentStatus);
  const [reason, setReason] = useState("");
  const [autoCreateWorkOrder, setAutoCreateWorkOrder] = useState(true);
  const [isPending, startTransition] = useTransition();

  const needsReason = status === "MAINTENANCE" || status === "CLOSED";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Update Ride Status"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            loading={isPending}
            onClick={() => {
              startTransition(() => {
                void fetch(`/api/v1/rides/${rideId}/status`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status, reason, autoCreateWorkOrder }),
                }).then(() => {
                  onUpdated?.();
                  onClose();
                });
              });
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Select
          label="New Status"
          value={status}
          onChange={(event) => setStatus(event.target.value as RideStatusModalProps["currentStatus"])}
          options={[
            { label: "ACTIVE", value: "ACTIVE" },
            { label: "MAINTENANCE", value: "MAINTENANCE" },
            { label: "CLOSED", value: "CLOSED" },
            { label: "SEASONAL", value: "SEASONAL" },
          ]}
        />

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--color-text)]">Reason</label>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required={needsReason}
            className="h-28 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 text-sm"
          />
        </div>

        {status === "MAINTENANCE" ? (
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={autoCreateWorkOrder}
              onChange={(event) => setAutoCreateWorkOrder(event.target.checked)}
            />
            Auto-create work order
          </label>
        ) : null}
      </div>
    </Modal>
  );
}
