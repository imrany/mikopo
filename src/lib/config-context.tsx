import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicBusinessConfig } from "./account.functions";
import { deriveFullThemeTokens } from "./theme-utils";
import { DEFAULT_TERMS_MARKDOWN, DEFAULT_PRIVACY_MARKDOWN } from "./default-policies";

export interface AppConfig {
  businessName: string;
  businessLocation: string;
  supportPhone: string;
  supportEmail: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  goldColor: string;
  landingContent: string;
  termsContent: string;
  privacyContent: string;
  enable2faByEmail: boolean;
  lockDarajaConfig: boolean;
  lockSmtpConfig: boolean;
  allowActivationWithoutDisbursement: boolean;
  maxActiveLoansPerBorrower: number;
  requireGuarantorsForLoans: boolean;
  autoRejectIfDefaulted: boolean;
  lockLandingEditMode: boolean;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  businessName:
    (typeof process !== "undefined" && process.env?.["BUSINESS_NAME"]) || "Lending Platform",
  businessLocation: "Nairobi, Kenya",
  supportPhone: "",
  supportEmail: "",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "",
  secondaryColor: "",
  accentColor: "",
  backgroundColor: "",
  foregroundColor: "",
  goldColor: "",
  landingContent: "",
  termsContent: DEFAULT_TERMS_MARKDOWN,
  privacyContent: DEFAULT_PRIVACY_MARKDOWN,
  enable2faByEmail: false,
  lockDarajaConfig: false,
  lockSmtpConfig: false,
  allowActivationWithoutDisbursement: false,
  maxActiveLoansPerBorrower: 1,
  requireGuarantorsForLoans: true,
  autoRejectIfDefaulted: true,
  lockLandingEditMode: false,
};

export interface AppConfigContextValue {
  config: AppConfig;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
  updateConfigOptimistic: (patch: Partial<AppConfig>) => void;
  notifyConfigChanged: (updated?: Partial<AppConfig>) => void;
  contentMap: Record<string, string>;
  getContent: (id: string, defaultText: string) => string;

  // Convenient shortcuts
  businessName: string;
  businessLocation: string;
  supportPhone: string;
  supportEmail: string;
  logoUrl: string;
  faviconUrl: string;
  heroImageUrl: string;
  termsContent: string;
  privacyContent: string;
  requireGuarantorsForLoans: boolean;
  allowActivationWithoutDisbursement: boolean;
  maxActiveLoansPerBorrower: number;
  autoRejectIfDefaulted: boolean;
  lockLandingEditMode: boolean;
}

const AppConfigContext = createContext<AppConfigContextValue | null>(null);

const STORAGE_CACHE_KEY = "mikopo_cached_business_config";
const BROADCAST_CHANNEL_NAME = "mikopo_config_sync_channel";
const CONFIG_CUSTOM_EVENT = "mikopo:config-changed";

function getCachedConfig(): AppConfig {
  if (typeof window === "undefined") return DEFAULT_APP_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_APP_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn("[AppConfig] Failed to parse cached business config:", e);
  }
  return DEFAULT_APP_CONFIG;
}

function applyThemeColorsToDOM(config: Partial<AppConfig>) {
  if (typeof document === "undefined") return;

  // 1. Update Favicon if provided
  if (config.faviconUrl !== undefined) {
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.getElementsByTagName("head")[0]?.appendChild(link);
    }
    const targetFavicon = config.faviconUrl || "/pwa-icon.png";
    if (link.getAttribute("href") !== targetFavicon) {
      link.setAttribute("href", targetFavicon);
    }
  }

  // 2. Inject CSS theme variable tokens into :root
  const root = document.documentElement;
  const hasAnyCustom =
    Boolean(config.primaryColor) ||
    Boolean(config.secondaryColor) ||
    Boolean(config.accentColor) ||
    Boolean(config.backgroundColor) ||
    Boolean(config.foregroundColor) ||
    Boolean(config.goldColor);

  if (hasAnyCustom) {
    const tokens = deriveFullThemeTokens({
      primary: config.primaryColor,
      secondary: config.secondaryColor,
      accent: config.accentColor,
      background: config.backgroundColor,
      foreground: config.foregroundColor,
      gold: config.goldColor,
    });

    for (const [key, value] of Object.entries(tokens)) {
      if (value) {
        root.style.setProperty(key, value);
      }
    }
  }
}

export function AppConfigProvider({
  children,
  initialConfig,
}: {
  children: ReactNode;
  initialConfig?: Partial<AppConfig>;
}) {
  const queryClient = useQueryClient();
  const getPublicConfigFn = useServerFn(getPublicBusinessConfig);

  const [optimisticConfig, setOptimisticConfig] = useState<AppConfig>(() => {
    const base: AppConfig = { ...DEFAULT_APP_CONFIG };
    if (initialConfig) {
      for (const [k, v] of Object.entries(initialConfig)) {
        if (v !== undefined && v !== null && v !== "") {
          (base as unknown as Record<string, unknown>)[k] = v;
        }
      }
    }
    return base;
  });

  const {
    data: serverConfig,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["public-business-config"],
    queryFn: () => getPublicConfigFn(),
    initialData:
      initialConfig && Object.keys(initialConfig).length > 0
        ? ({ ...DEFAULT_APP_CONFIG, ...initialConfig } as AppConfig)
        : undefined,
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  // Restore cached config on client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = getCachedConfig();
      if (cached && cached.businessName) {
        setOptimisticConfig((prev) => ({ ...prev, ...cached }));
      }
    }
  }, []);

  // Sync server data into state and cache
  useEffect(() => {
    if (serverConfig) {
      const merged: AppConfig = {
        ...DEFAULT_APP_CONFIG,
        ...serverConfig,
      };
      setOptimisticConfig((prev) => ({ ...prev, ...merged }));
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(merged));
        } catch (err) {
          console.warn("[AppConfig] LocalStorage write error:", err);
        }
      }
      applyThemeColorsToDOM(merged);
    }
  }, [serverConfig]);

  // Initial theme application
  useEffect(() => {
    applyThemeColorsToDOM(optimisticConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update optimistic config with zero latency
  const updateConfigOptimistic = useCallback((patch: Partial<AppConfig>) => {
    setOptimisticConfig((prev) => {
      const next = { ...prev, ...patch };
      applyThemeColorsToDOM(next);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(next));
        } catch (err) {
          console.warn("[AppConfig] LocalStorage write error:", err);
        }
      }
      return next;
    });

    // Broadcast to other tabs & custom window event
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(CONFIG_CUSTOM_EVENT, { detail: patch }));
      try {
        if ("BroadcastChannel" in window) {
          const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
          bc.postMessage({ type: "CONFIG_PATCH", patch });
          bc.close();
        }
      } catch (err) {
        console.warn("[AppConfig] BroadcastChannel error:", err);
      }
    }
  }, []);

  // Notify that config has changed (e.g. after an admin mutation)
  const notifyConfigChanged = useCallback(
    (updated?: Partial<AppConfig>) => {
      if (updated) {
        updateConfigOptimistic(updated);
      }
      void queryClient.invalidateQueries({ queryKey: ["public-business-config"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-rules"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["loan-products"] });
      void refetch();

      if (typeof window !== "undefined") {
        try {
          if ("BroadcastChannel" in window) {
            const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
            bc.postMessage({ type: "CONFIG_REFETCH", patch: updated });
            bc.close();
          }
        } catch (err) {
          console.warn("[AppConfig] BroadcastChannel error:", err);
        }
      }
    },
    [queryClient, refetch, updateConfigOptimistic],
  );

  // Listen to cross-tab broadcast channel & custom events for real-time synchronization
  useEffect(() => {
    if (typeof window === "undefined") return;

    let bc: BroadcastChannel | null = null;
    try {
      if ("BroadcastChannel" in window) {
        bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        bc.onmessage = (event) => {
          if (event.data?.type === "CONFIG_PATCH" && event.data.patch) {
            setOptimisticConfig((prev) => {
              const next = { ...prev, ...event.data.patch };
              applyThemeColorsToDOM(next);
              return next;
            });
            void queryClient.invalidateQueries({ queryKey: ["public-business-config"] });
          } else if (event.data?.type === "CONFIG_REFETCH") {
            if (event.data.patch) {
              setOptimisticConfig((prev) => {
                const next = { ...prev, ...event.data.patch };
                applyThemeColorsToDOM(next);
                return next;
              });
            }
            void queryClient.invalidateQueries({ queryKey: ["public-business-config"] });
            void refetch();
          }
        };
      }
    } catch (err) {
      console.warn("[AppConfig] BroadcastChannel init error:", err);
    }

    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Partial<AppConfig>>;
      if (customEvent.detail) {
        setOptimisticConfig((prev) => {
          const next = { ...prev, ...customEvent.detail };
          applyThemeColorsToDOM(next);
          return next;
        });
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_CACHE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setOptimisticConfig((prev) => {
            const next = { ...prev, ...parsed };
            applyThemeColorsToDOM(next);
            return next;
          });
          void queryClient.invalidateQueries({ queryKey: ["public-business-config"] });
        } catch (err) {
          console.warn("[AppConfig] Storage event parse error:", err);
        }
      }
    };

    window.addEventListener(CONFIG_CUSTOM_EVENT, handleCustomEvent);
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      if (bc) {
        bc.close();
      }
      window.removeEventListener(CONFIG_CUSTOM_EVENT, handleCustomEvent);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [queryClient, refetch]);

  // Parse landing content JSON
  const contentMap = useMemo(() => {
    if (!optimisticConfig.landingContent) return {};
    try {
      return JSON.parse(optimisticConfig.landingContent);
    } catch {
      return {};
    }
  }, [optimisticConfig.landingContent]);

  const getContent = useCallback(
    (id: string, defaultText: string) => {
      return contentMap[id] ?? defaultText;
    },
    [contentMap],
  );

  const value = useMemo<AppConfigContextValue>(() => {
    return {
      config: optimisticConfig,
      isLoading,
      isFetching,
      refetch,
      updateConfigOptimistic,
      notifyConfigChanged,
      contentMap,
      getContent,

      businessName:
        optimisticConfig.businessName ||
        (typeof process !== "undefined" && process.env?.["BUSINESS_NAME"]) ||
        "Lending Platform",
      businessLocation: optimisticConfig.businessLocation || "Nairobi, Kenya",
      supportPhone: optimisticConfig.supportPhone,
      supportEmail: optimisticConfig.supportEmail,
      logoUrl: optimisticConfig.logoUrl,
      faviconUrl: optimisticConfig.faviconUrl,
      heroImageUrl: contentMap["hero_image_url"] || "",
      termsContent: optimisticConfig.termsContent || DEFAULT_TERMS_MARKDOWN,
      privacyContent: optimisticConfig.privacyContent || DEFAULT_PRIVACY_MARKDOWN,
      requireGuarantorsForLoans: optimisticConfig.requireGuarantorsForLoans,
      allowActivationWithoutDisbursement: optimisticConfig.allowActivationWithoutDisbursement,
      maxActiveLoansPerBorrower: optimisticConfig.maxActiveLoansPerBorrower,
      autoRejectIfDefaulted: optimisticConfig.autoRejectIfDefaulted,
      lockLandingEditMode: optimisticConfig.lockLandingEditMode,
    };
  }, [
    optimisticConfig,
    isLoading,
    isFetching,
    refetch,
    updateConfigOptimistic,
    notifyConfigChanged,
    contentMap,
    getContent,
  ]);

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig(): AppConfigContextValue {
  const context = useContext(AppConfigContext);
  if (!context) {
    throw new Error("useAppConfig must be used within an AppConfigProvider");
  }
  return context;
}

// Alias for convenience
export const useConfig = useAppConfig;
