"use client";

import { useState } from "react";

import { LeadDrawer, type LeadDrawerProps } from "@/components/crm/LeadDrawer";
import { Button } from "@/components/ui/Button";

export interface AddLeadModalProps {
  assignees: LeadDrawerProps["assignees"];
  onCreated?: () => void;
}

export function AddLeadModal({ assignees, onCreated }: AddLeadModalProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Lead</Button>
      <LeadDrawer
        open={open}
        onClose={() => setOpen(false)}
        assignees={assignees}
        onCreated={onCreated}
      />
    </>
  );
}
