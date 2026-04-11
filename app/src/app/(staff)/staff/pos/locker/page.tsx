"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { SessionOpener } from "@/components/pos/SessionOpener";
import { LockerTerminal } from "@/components/pos/LockerTerminal";
import { useResolvedTerminalId } from "@/components/pos/useResolvedTerminalId";

interface ActiveSession {
  id: string;
  staffName: string;
}

export default function LockerPosPage() {
  const searchParams = useSearchParams();
  const terminalId = useResolvedTerminalId({
    searchParams,
    envTerminalId: process.env.NEXT_PUBLIC_POS_TERMINAL_LOCKER,
    storageKey: "wp.pos.terminal.locker",
    prefix: "LOCKER",
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
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    if (terminalId) {
      checkSession();
      return;
    }
    setLoading(false);
  }, [terminalId]);

  if (loading || !terminalId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!session) {
    return (
      <SessionOpener
        terminalId={terminalId}
        onSessionOpened={(id) => setSession({ id, staffName: "You" })}
      />
    );
  }

  return (
    <LockerTerminal
      sessionId={session.id}
      terminalId={terminalId}
      cashierName={session.staffName}
      onSessionClosed={() => setSession(null)}
    />
  );
}
