"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ParkingTerminal } from "@/components/pos/ParkingTerminal";
import { SessionOpener } from "@/components/pos/SessionOpener";
import { useResolvedTerminalId } from "@/components/pos/useResolvedTerminalId";
import { authClient } from "@/lib/auth-client";

interface ActiveSession {
  id: string;
  staffName: string;
}

export default function ParkingPosPage(): JSX.Element {
  const router = useRouter();
  const { data: authSession } = authClient.useSession();
  const searchParams = useSearchParams();
  const canAccessAdminDashboard = authSession?.user?.role === "ADMIN";
  const terminalId = useResolvedTerminalId({
    searchParams,
    envTerminalId: process.env.NEXT_PUBLIC_POS_TERMINAL_PARKING,
    storageKey: "wp.pos.terminal.parking",
    prefix: "PARKING",
  });

  const [session, setSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch(`/api/v1/pos/sessions/active?terminalId=${terminalId}`);
        if (res.ok) {
          const data = await res.json();
          const s = data?.session;
          if (s?.id) {
            setSession({ id: s.id, staffName: s.staff?.name ?? "Staff" });
          }
        }
      } finally {
        setLoading(false);
      }
    }
    if (!terminalId) {
      setLoading(false);
      return;
    }
    void checkSession();
  }, [terminalId]);

  if (loading || !terminalId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-muted)]">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  if (!session) {
    return (
      <SessionOpener
        terminalId={terminalId}
        onSessionOpened={(id, staffName) => setSession({ id, staffName: staffName || "You" })}
      />
    );
  }

  return (
    <ParkingTerminal
      sessionId={session.id}
      terminalId={terminalId}
      cashierName={session.staffName}
      onExitPos={() => router.push("/staff/pos")}
      onSessionClosed={() => {
        setSession(null);
        if (canAccessAdminDashboard) {
          router.push("/admin/dashboard");
          return;
        }
        window.alert("You don't have permission to access admin dashboard.");
        router.push("/staff/pos");
      }}
    />
  );
}
