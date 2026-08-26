import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 12000,
        gcTime: 1000 * 60 * 60 * 24, // Keep cached data for 24 hours
        networkMode: "offlineFirst", // Return cached queries immediately offline
        refetchOnReconnect: true, // Automatically re-fetch in background on reconnect
        refetchOnWindowFocus: true, // Seamlessly update data in background when user returns to window
        retry: 1,
      },
      mutations: {
        networkMode: "online", // Prevent firing mutating financial actions if strictly offline
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
