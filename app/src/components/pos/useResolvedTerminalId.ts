"use client";

import { useEffect, useState } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";

interface UseResolvedTerminalIdOptions {
  searchParams: ReadonlyURLSearchParams;
  envTerminalId?: string;
  storageKey: string;
  prefix: string;
}

function generateTerminalId(prefix: string): string {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${suffix}`;
}

export function useResolvedTerminalId({
  searchParams,
  envTerminalId,
  storageKey,
  prefix,
}: UseResolvedTerminalIdOptions): string {
  const [terminalId, setTerminalId] = useState<string>("");

  useEffect(() => {
    const queryTerminalId = searchParams.get("terminalId")?.trim();
    if (queryTerminalId) {
      window.localStorage.setItem(storageKey, queryTerminalId);
      setTerminalId(queryTerminalId);
      return;
    }

    const envValue = envTerminalId?.trim();
    if (envValue) {
      window.localStorage.setItem(storageKey, envValue);
      setTerminalId(envValue);
      return;
    }

    const stored = window.localStorage.getItem(storageKey)?.trim();
    if (stored) {
      setTerminalId(stored);
      return;
    }

    const generated = generateTerminalId(prefix);
    window.localStorage.setItem(storageKey, generated);
    setTerminalId(generated);
  }, [envTerminalId, prefix, searchParams, storageKey]);

  return terminalId;
}

