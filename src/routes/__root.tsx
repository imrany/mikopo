import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Coins } from "lucide-react";
import { useAppHistoryTracker } from "@/hooks/use-app-history-tracker";
import { popPath } from "@/lib/app-history";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-context";
import { AppConfigProvider } from "@/lib/config-context";
import { Toaster } from "@/components/ui/sonner";
import { getPublicBusinessConfig } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { BrandThemeProvider } from "@/components/brand-theme-provider";
import { PwaInstaller } from "@/components/pwa-installer";
import { TooltipProvider } from "@/components/ui/tooltip";

function NotFoundComponent() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Button variant="ghost" onClick={() => navigate({ to: popPath() as string })}>
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            variant="default"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
          <Button variant="ghost" onClick={() => navigate({ to: popPath() as string })}>
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async () => {
    try {
      const config = await getPublicBusinessConfig();
      if (typeof localStorage !== "undefined" && config) {
        try {
          localStorage.setItem("mikopo_cached_business_config", JSON.stringify(config));
        } catch (e) {
          console.warn("[RootLoader] Could not cache business config:", e);
        }
      }
      return config;
    } catch {
      if (typeof localStorage !== "undefined") {
        try {
          const cached = localStorage.getItem("mikopo_cached_business_config");
          if (cached) {
            return JSON.parse(cached);
          }
        } catch (e) {
          console.warn("[RootLoader] Could not parse cached business config:", e);
        }
      }
      return {
        businessName: process.env["BUSINESS_NAME"] || "",
        businessLocation: "",
        supportPhone: "",
        supportEmail: "",
        logoUrl: "",
        termsContent: "",
        privacyContent: "",
      };
    }
  },
  head: ({ loaderData }) => {
    const businessName = loaderData?.businessName || process.env["BUSINESS_NAME"] || "";
    const location = loaderData?.businessLocation || "";
    const title = businessName ? `${businessName} — Instant M-Pesa Loans & Microfinance` : "";
    const description = businessName
      ? `${businessName} — Fast, secure M-Pesa loan management, instant disbursements, credibility-based limits, and guarantor-backed loans${location ? ` in ${location}` : ""}.`
      : "";

    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        ...(title ? [{ title }] : [{ title: "" }]),
        ...(description ? [{ name: "description", content: description }] : []),
        {
          name: "keywords",
          content:
            "M-Pesa loans, mobile microloans Kenya, online instant loan, STK push Kenya, Daraja API loans, Nairobi microfinance, peer guarantor loans, credibility credit score",
        },
        {
          name: "robots",
          content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
        },
        ...(title ? [{ property: "og:title", content: title }] : []),
        ...(description ? [{ property: "og:description", content: description }] : []),
        ...(businessName ? [{ property: "og:site_name", content: businessName }] : []),
        { property: "og:type", content: "website" },
        { property: "og:locale", content: "en_KE" },
        { property: "og:image", content: "/hero-image.png" },
        { property: "og:image:secure_url", content: "/hero-image.png" },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        ...(businessName
          ? [
              {
                property: "og:image:alt",
                content: `${businessName} Instant M-Pesa Microloans Platform`,
              },
            ]
          : []),
        { name: "twitter:card", content: "summary_large_image" },
        ...(title ? [{ name: "twitter:title", content: title }] : []),
        ...(description ? [{ name: "twitter:description", content: description }] : []),
        { name: "twitter:image", content: "/hero-image.png" },
        ...(businessName
          ? [
              {
                name: "twitter:image:alt",
                content: `${businessName} Instant M-Pesa Microloans Platform`,
              },
            ]
          : []),
        { name: "theme-color", content: "#0b0f19" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        ...(businessName ? [{ name: "apple-mobile-web-app-title", content: businessName }] : []),
        ...(businessName ? [{ name: "application-name", content: businessName }] : []),
        { name: "format-detection", content: "telephone=no" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap",
        },
        { rel: "icon", href: "/favicon.ico", sizes: "any" },
        { rel: "icon", href: "/favicon.png", sizes: "32x32", type: "image/png" },
        { rel: "icon", href: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
        { rel: "icon", href: "/pwa-icon.png", sizes: "512x512", type: "image/png" },
        { rel: "apple-touch-icon", href: "/pwa-icon.png", sizes: "180x180" },
        { rel: "shortcut icon", href: "/favicon.ico" },
        { rel: "manifest", href: "/manifest.json" },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  pendingComponent: RootPendingComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootPendingComponent() {
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const t1 = setTimeout(() => setProgress(35), 70);
    const t2 = setTimeout(() => setProgress(58), 200);
    const t3 = setTimeout(() => setProgress(78), 450);
    const t4 = setTimeout(() => setProgress(89), 850);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 96) return prev;
        const diff = (96 - prev) * 0.12;
        return Math.min(96, Math.round((prev + Math.max(0.4, diff)) * 10) / 10);
      });
    }, 220);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-xs sm:max-w-sm flex flex-col items-center gap-4">
        <div className="relative flex size-12 items-center justify-center">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/15 opacity-75 duration-1000" />
          <span className="relative inline-flex size-11 items-center justify-center rounded-2xl bg-gradient-brand shadow-md">
            <Coins className="size-5 text-primary-foreground animate-pulse" />
          </span>
        </div>

        <div className="w-full space-y-2">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/80 border border-border/40">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out relative overflow-hidden"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground tabular-nums">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-primary animate-ping inline-block" />
              <span>Loading...</span>
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const loaderData = Route.useLoaderData();
  useAppHistoryTracker();
  return (
    <QueryClientProvider client={queryClient}>
      <AppConfigProvider initialConfig={loaderData}>
        <AuthProvider>
          <TooltipProvider delayDuration={150}>
            <BrandThemeProvider />
            <PwaInstaller />
            <Outlet />
            <Toaster position="top-center" richColors />
          </TooltipProvider>
        </AuthProvider>
      </AppConfigProvider>
    </QueryClientProvider>
  );
}
