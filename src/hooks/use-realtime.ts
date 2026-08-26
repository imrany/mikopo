import { useEffect, useRef, useCallback } from "react";
import { RealtimeSyncTopic, subscribeToSync, broadcastSync } from "@/lib/realtime-sync";

export interface RealtimeOptions {
  intervalMs?: number;
  enableFocusRefetch?: boolean;
  enableVisibilityRefetch?: boolean;
  enabled?: boolean;
}

/**
 * Periodically polls for updates and listens to real-time sync broadcast events across
 * tabs and actions, ensuring live updates occur smoothly without manual refreshes.
 */
export function useRealtimeTable(
  table: string,
  _filter: { column: string; value: string },
  onChange: () => void,
  intervalMs = 8000,
) {
  // Map table name to corresponding sync topics
  const topics: RealtimeSyncTopic[] = [];
  if (table === "loans" || table === "loan_status_events") {
    topics.push("LOAN_STATUS_CHANGED", "PAYMENT_RECEIVED", "GUARANTOR_UPDATED");
  } else if (table === "repayments") {
    topics.push("PAYMENT_RECEIVED", "LOAN_STATUS_CHANGED");
  } else if (table === "notifications") {
    topics.push("NOTIFICATION_RECEIVED", "NOTIFICATION_READ");
  } else if (table === "user_guarantors") {
    topics.push("GUARANTOR_UPDATED", "LOAN_STATUS_CHANGED");
  } else if (table === "credibility") {
    topics.push("CREDIBILITY_UPDATED", "PAYMENT_RECEIVED");
  } else {
    topics.push("ALL");
  }

  useRealtimeSync(topics, onChange, {
    intervalMs,
    enableFocusRefetch: true,
    enableVisibilityRefetch: true,
  });
}

/**
 * Hook to subscribe to real-time events, window focus, visibility shifts, and background polling.
 */
export function useRealtimeSync(
  topicOrTopics: RealtimeSyncTopic | RealtimeSyncTopic[],
  onUpdate: () => void,
  options: RealtimeOptions = {},
) {
  const {
    intervalMs = 10000,
    enableFocusRefetch = true,
    enableVisibilityRefetch = true,
    enabled = true,
  } = options;

  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  const triggerUpdate = useCallback(() => {
    if (!enabled) return;
    try {
      callbackRef.current();
    } catch (e) {
      console.warn("[RealtimeSync] Callback execution error:", e);
    }
  }, [enabled]);

  // 1. Subscribe to Cross-Tab & In-App Real-time Broadcasts
  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = subscribeToSync(topicOrTopics, () => {
      triggerUpdate();
    });
    return unsubscribe;
  }, [topicOrTopics, enabled, triggerUpdate]);

  // 2. Window Focus & Visibility Change Listeners (Instant Revalidation upon returning)
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handleFocus = () => {
      if (enableFocusRefetch) {
        triggerUpdate();
      }
    };

    const handleVisibilityChange = () => {
      if (enableVisibilityRefetch && document.visibilityState === "visible") {
        triggerUpdate();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, enableFocusRefetch, enableVisibilityRefetch, triggerUpdate]);

  // 3. Adaptive background interval polling (runs faster when tab is active, pauses or throttles when hidden)
  useEffect(() => {
    if (!enabled || !intervalMs || intervalMs <= 0) return;

    let timer: NodeJS.Timeout | null = null;

    const scheduleNext = () => {
      const isVisible =
        typeof document !== "undefined" ? document.visibilityState === "visible" : true;
      const currentDelay = isVisible ? intervalMs : Math.max(intervalMs * 3, 30000);

      timer = setTimeout(() => {
        triggerUpdate();
        scheduleNext();
      }, currentDelay);
    };

    scheduleNext();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [enabled, intervalMs, triggerUpdate]);
}

export { broadcastSync };
