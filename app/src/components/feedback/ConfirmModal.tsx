"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  requireReason?: boolean;
  reasonLabel?: string;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
  loading?: boolean;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  requireReason,
  reasonLabel = "Reason",
  onCancel,
  onConfirm,
  loading,
}: ConfirmModalProps): JSX.Element {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();

  const handleConfirm = (): void => {
    if (requireReason && reason.trim().length === 0) {
      setError("Reason is required");
      return;
    }
    setError(undefined);
    onConfirm(reason.trim() || undefined);
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" loading={loading} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {requireReason ? (
        <Input
          label={reasonLabel}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          error={error}
          placeholder="Enter reason"
        />
      ) : null}
    </Modal>
  );
}