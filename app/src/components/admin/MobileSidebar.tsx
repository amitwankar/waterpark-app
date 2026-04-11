"use client";

import { Sidebar } from "@/components/admin/Sidebar";
import { Drawer } from "@/components/ui/Drawer";

export interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
  pendingUpiCount?: number;
  userName?: string | null;
  userRole?: string | null;
}

export function MobileSidebar({
  open,
  onClose,
  pendingUpiCount,
  userName,
  userRole,
}: MobileSidebarProps): JSX.Element {
  return (
    <Drawer open={open} onClose={onClose} title="Navigation" widthClassName="w-80">
      <div className="-m-4">
        <Sidebar
          collapsed={false}
          pendingUpiCount={pendingUpiCount}
          user={{
            name: userName,
            role: userRole,
          }}
          mobile
        />
      </div>
    </Drawer>
  );
}
