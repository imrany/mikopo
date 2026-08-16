import { useEffect } from "react";

/**
 * Periodically polls for updates on active data, ensuring live status changes (e.g. loan approvals, repayment receipts)
 * refresh smoothly without needing Supabase.
 */
export function useRealtimeTable(
  _table: string,
  _filter: { column: string; value: string },
  onChange: () => void,
  intervalMs = 10000,
) {
  useEffect(() => {
    const timer = setInterval(() => {
      onChange();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [onChange, intervalMs]);
}
