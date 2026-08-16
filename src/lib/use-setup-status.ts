import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSetupStatus } from "@/lib/account.functions";

/** Returns whether the one-time business setup still needs to be run. */
export function useSetupStatus() {
  const statusFn = useServerFn(getSetupStatus);
  const query = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => statusFn(),
    staleTime: 5 * 60 * 1000,
  });

  return {
    isLoading: query.isLoading,
    // Assume configured until proven otherwise so the CTA never flashes.
    needsSetup: query.data?.needsSetup ?? false,
    locked: query.data?.locked ?? true,
  };
}
