import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { pushPath } from "@/lib/app-history";

/**
 * Mount this ONCE at the app root (not inside BackButton).
 * Records every resolved navigation into the history stack.
 */
export function useAppHistoryTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    pushPath(pathname);
  }, [pathname]);
}
