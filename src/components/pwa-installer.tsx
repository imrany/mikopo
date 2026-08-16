import { useEffect, useState } from "react";
import { Download, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useAppConfig } from "@/lib/config-context";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const queryClient = useQueryClient();
  const { refresh } = useAuth();
  const { businessName } = useAppConfig();

  // Safe helper to determine if ServiceWorker API can be safely used
  const isServiceWorkerSafe = () => {
    try {
      return (
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        window.isSecureContext &&
        window.location.protocol.startsWith("http")
      );
    } catch {
      return false;
    }
  };

  useEffect(() => {
    // Monitor online/offline state & trigger background revalidation
    const handleOnline = async () => {
      setIsOffline(false);

      // Signal Service Worker to revalidate and sync caches in background if available
      try {
        if (isServiceWorkerSafe() && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: "ONLINE_SYNC" });
          navigator.serviceWorker
            .getRegistration()
            .then((reg) => {
              if (reg) reg.update();
            })
            .catch(() => {});
        }
      } catch (err) {
        console.warn("[PWA] Service worker sync notice:", err);
      }

      // Re-fetch active queries in background without flashing loaders
      try {
        await queryClient.invalidateQueries();
        void refresh();
      } catch (err) {
        console.warn("[OfflineSync] Background query revalidation notice:", err);
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOffline(typeof navigator !== "undefined" ? !navigator.onLine : false);

    // 2. Automatic Service Worker Registration & Silent Background Updates
    if (isServiceWorkerSafe()) {
      let refreshing = false;

      // Automatically reload or take control when a new service worker takes over
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      const applyNewWorker = (worker: ServiceWorker | null) => {
        if (worker) {
          try {
            worker.postMessage({ type: "SKIP_WAITING" });
          } catch (e) {
            console.warn("[PWA] Error posting skip waiting:", e);
          }
        }
      };

      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // Check if there's already a waiting worker - immediately skip waiting automatically
          if (registration.waiting) {
            applyNewWorker(registration.waiting);
          }

          // Listen for new updates arriving in background
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // Automatically activate the update without disrupting user
                  applyNewWorker(installingWorker);
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration skipped:", err);
        });

      // Periodic background update check every 5 minutes and on window focus
      const checkUpdate = () => {
        if (navigator.onLine && isServiceWorkerSafe()) {
          navigator.serviceWorker
            .getRegistration()
            .then((reg) => {
              if (reg) reg.update();
            })
            .catch(() => {});
        }
      };

      const interval = setInterval(checkUpdate, 5 * 60 * 1000);
      window.addEventListener("focus", checkUpdate);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkUpdate();
      });

      return () => {
        clearInterval(interval);
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("focus", checkUpdate);
      };
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [queryClient, refresh]);

  // Listen for PWA installation prompt
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      try {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      } catch (err) {
        console.warn("[PWA] beforeinstallprompt handling skipped:", err);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    try {
      if (
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(display-mode: standalone)").matches
      ) {
        setIsInstalled(true);
      }
    } catch {
      // Ignore iframe media query restrictions
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <>
      {/* Offline Status Badge Banner */}
      {isOffline && (
        <div className="bg-card/95 backdrop-blur-md border-b border-warning/30 px-4 py-2 text-foreground shadow-soft transition-all duration-300">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="flex size-6 items-center justify-center rounded-lg bg-warning/15 text-warning shrink-0">
                <WifiOff className="size-3.5" />
              </span>
              <span className="font-medium text-foreground">
                <strong className="font-semibold text-warning">Offline Mode:</strong> Viewing cached
                loan records and balances.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-[11px] text-muted-foreground">
                Requests will sync on reconnect
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="h-6 px-2 text-[11px] font-medium border-border/80 hover:bg-accent gap-1"
              >
                <RefreshCw className="size-2.5" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop/Mobile PWA Install Prompt Banner (if installable and not installed) */}
      {deferredPrompt && !isInstalled && (
        <div className="fixed bottom-4 left-4 z-50 bg-slate-900/95 backdrop-blur-md border border-slate-800 text-white p-3 rounded-xl shadow-xl flex items-center gap-3 text-xs max-w-sm">
          <div className="p-2 rounded-lg bg-primary/20 text-primary shrink-0">
            <Download className="size-4 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground">Install {businessName} App</div>
            <div className="text-muted-foreground text-[11px] truncate">
              Fast access from home screen
            </div>
          </div>
          <Button
            onClick={handleInstallClick}
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-7 px-2.5 font-medium shrink-0"
          >
            Install
          </Button>
        </div>
      )}
    </>
  );
}
