import { useEffect } from "react";
import { useAppConfig } from "@/lib/config-context";
import { deriveFullThemeTokens } from "@/lib/theme-utils";

export function BrandThemeProvider() {
  const { config } = useAppConfig();

  useEffect(() => {
    if (!config) return;

    // 1. Update Favicon if provided
    if (config.faviconUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.getElementsByTagName("head")[0]?.appendChild(link);
      }
      if (link.href !== config.faviconUrl) {
        link.href = config.faviconUrl;
      }
    }

    // 2. Inject Comprehensive Custom Brand Theme Tokens into Document Root
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
  }, [config]);

  return null;
}
