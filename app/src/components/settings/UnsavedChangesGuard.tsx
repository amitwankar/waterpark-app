"use client";

import { useEffect } from "react";

export interface UnsavedChangesGuardProps {
  enabled: boolean;
}

export function UnsavedChangesGuard({ enabled }: UnsavedChangesGuardProps): null {
  useEffect(() => {
    if (!enabled) return;

    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      if (link.target === "_blank") return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const proceed = window.confirm("You have unsaved changes. Leave this page?");
      if (!proceed) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [enabled]);

  return null;
}
