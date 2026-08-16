import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  FileText,
  Shield,
  Image as ImageIcon,
  Save,
  LucideLoader,
  Palette,
  Eye,
  Sparkles,
  Check,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { getAdminOverview, adminUpdateBusinessSettings } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { DEFAULT_TERMS_MARKDOWN, DEFAULT_PRIVACY_MARKDOWN } from "@/lib/default-policies";
import { IconAutocompleteTextarea } from "@/components/icon-autocomplete-editor";
import {
  PRESET_THEME_PALETTES,
  ORIGINAL_DEFAULT_PALETTE,
  deriveFullThemeTokens,
  type ThemePalette,
} from "@/lib/theme-utils";
import { useAppConfig } from "@/lib/config-context";
import { ImageUploadDialog } from "@/components/image-upload-dialog";
import { useUrlBooleanState } from "@/lib/use-url-search-state";

function applyThemeTokensToDOM(tokens: Record<string, string>) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    if (value) {
      root.style.setProperty(key, value);
    }
  }
}

export function BusinessSettingsForm() {
  const { token, isStaff } = useAuth();
  const queryClient = useQueryClient();
  const { updateConfigOptimistic, notifyConfigChanged } = useAppConfig();

  const getOverviewFn = useServerFn(getAdminOverview);
  const updateSettingsFn = useServerFn(adminUpdateBusinessSettings);

  const { data: overview, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () =>
      getOverviewFn({
        headers: { authorization: `Bearer ${token}` },
      }),
    enabled: Boolean(isStaff && token),
  });

  const [businessName, setBusinessName] = useState("");
  const [businessLocation, setBusinessLocation] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");

  const [primaryColor, setPrimaryColor] = useState(ORIGINAL_DEFAULT_PALETTE.primary);
  const [secondaryColor, setSecondaryColor] = useState(ORIGINAL_DEFAULT_PALETTE.secondary);
  const [accentColor, setAccentColor] = useState(ORIGINAL_DEFAULT_PALETTE.accent);
  const [backgroundColor, setBackgroundColor] = useState(ORIGINAL_DEFAULT_PALETTE.background);
  const [foregroundColor, setForegroundColor] = useState(ORIGINAL_DEFAULT_PALETTE.foreground);
  const [goldColor, setGoldColor] = useState(ORIGINAL_DEFAULT_PALETTE.gold);

  const [isLogoDialogOpen, setIsLogoDialogOpen] = useUrlBooleanState("editLogo");
  const [isFaviconDialogOpen, setIsFaviconDialogOpen] = useUrlBooleanState("editFavicon");

  const [termsContent, setTermsContent] = useState("");
  const [privacyContent, setPrivacyContent] = useState("");

  const [previewTerms, setPreviewTerms] = useState(false);
  const [previewPrivacy, setPreviewPrivacy] = useState(false);

  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const isInitialLoadRef = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (overview?.settings && isInitialLoadRef.current) {
      setBusinessName(overview.settings.business_name || "");
      setBusinessLocation(overview.settings.business_location || "");
      setSupportPhone(overview.settings.support_phone || "");
      setSupportEmail(overview.settings.support_email || "");
      setLogoUrl(overview.settings.logo_url || "");
      setFaviconUrl(overview.settings.favicon_url || "");

      if (overview.settings.primary_color) setPrimaryColor(overview.settings.primary_color);
      if (overview.settings.secondary_color) setSecondaryColor(overview.settings.secondary_color);
      if (overview.settings.accent_color) setAccentColor(overview.settings.accent_color);
      if (overview.settings.background_color)
        setBackgroundColor(overview.settings.background_color);
      if (overview.settings.foreground_color)
        setForegroundColor(overview.settings.foreground_color);
      if (overview.settings.gold_color) setGoldColor(overview.settings.gold_color);

      setTermsContent(overview.settings.terms_content || DEFAULT_TERMS_MARKDOWN);
      setPrivacyContent(overview.settings.privacy_content || DEFAULT_PRIVACY_MARKDOWN);
      isInitialLoadRef.current = false;
    }
  }, [overview]);

  const updateMutation = useMutation({
    mutationFn: (input: {
      businessName: string;
      businessLocation: string;
      supportPhone?: string;
      supportEmail?: string;
      logoUrl?: string;
      faviconUrl?: string;
      primaryColor?: string;
      secondaryColor?: string;
      accentColor?: string;
      backgroundColor?: string;
      foregroundColor?: string;
      goldColor?: string;
      termsContent?: string;
      privacyContent?: string;
    }) =>
      updateSettingsFn({
        data: input,
        headers: { authorization: `Bearer ${token}` },
      }),
    onSuccess: (res) => {
      setIsAutoSaving(false);
      if (!res.ok) {
        toast.error("Failed to update business settings");
        return;
      }
      setLastAutoSavedAt(new Date());
      notifyConfigChanged({
        businessName,
        businessLocation,
        supportPhone,
        supportEmail,
        logoUrl,
        faviconUrl,
        primaryColor,
        secondaryColor,
        accentColor,
        backgroundColor,
        foregroundColor,
        goldColor,
        termsContent,
        privacyContent,
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["public-business-config"] });
    },
    onError: (err: Error) => {
      setIsAutoSaving(false);
      toast.error(err.message);
    },
  });

  const performSave = useCallback(
    (overrides?: {
      businessName?: string;
      businessLocation?: string;
      supportPhone?: string;
      supportEmail?: string;
      logoUrl?: string;
      faviconUrl?: string;
      primaryColor?: string;
      secondaryColor?: string;
      accentColor?: string;
      backgroundColor?: string;
      foregroundColor?: string;
      goldColor?: string;
      termsContent?: string;
      privacyContent?: string;
    }) => {
      const bName = (overrides?.businessName ?? businessName).trim() || "Lending Platform";
      const bLoc = (overrides?.businessLocation ?? businessLocation).trim() || "Nairobi, Kenya";

      const payload = {
        businessName: bName,
        businessLocation: bLoc,
        supportPhone: (overrides?.supportPhone ?? supportPhone).trim(),
        supportEmail: (overrides?.supportEmail ?? supportEmail).trim(),
        logoUrl: (overrides?.logoUrl ?? logoUrl).trim(),
        faviconUrl: (overrides?.faviconUrl ?? faviconUrl).trim(),
        primaryColor: overrides?.primaryColor ?? primaryColor,
        secondaryColor: overrides?.secondaryColor ?? secondaryColor,
        accentColor: overrides?.accentColor ?? accentColor,
        backgroundColor: overrides?.backgroundColor ?? backgroundColor,
        foregroundColor: overrides?.foregroundColor ?? foregroundColor,
        goldColor: overrides?.goldColor ?? goldColor,
        termsContent: (overrides?.termsContent ?? termsContent).trim(),
        privacyContent: (overrides?.privacyContent ?? privacyContent).trim(),
      };

      updateConfigOptimistic(payload);
      setIsAutoSaving(true);
      updateMutation.mutate(payload);
    },
    [
      businessName,
      businessLocation,
      supportPhone,
      supportEmail,
      logoUrl,
      faviconUrl,
      primaryColor,
      secondaryColor,
      accentColor,
      backgroundColor,
      foregroundColor,
      goldColor,
      termsContent,
      privacyContent,
      updateConfigOptimistic,
      updateMutation,
    ],
  );

  const triggerDebouncedAutoSave = useCallback(
    (
      overrides?: {
        businessName?: string;
        businessLocation?: string;
        supportPhone?: string;
        supportEmail?: string;
        logoUrl?: string;
        faviconUrl?: string;
        primaryColor?: string;
        secondaryColor?: string;
        accentColor?: string;
        backgroundColor?: string;
        foregroundColor?: string;
        goldColor?: string;
        termsContent?: string;
        privacyContent?: string;
      },
      delay = 700,
    ) => {
      if (isInitialLoadRef.current) return;
      setIsAutoSaving(true);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        performSave(overrides);
      }, delay);
    },
    [performSave],
  );

  if (!isStaff) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    performSave();
  }

  function applyPalette(palette: ThemePalette) {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    setPrimaryColor(palette.primary);
    setSecondaryColor(palette.secondary);
    setAccentColor(palette.accent);
    setBackgroundColor(palette.background);
    setForegroundColor(palette.foreground);
    setGoldColor(palette.gold);

    updateConfigOptimistic({
      primaryColor: palette.primary,
      secondaryColor: palette.secondary,
      accentColor: palette.accent,
      backgroundColor: palette.background,
      foregroundColor: palette.foreground,
      goldColor: palette.gold,
    });

    // 1. Immediately apply tokens to document DOM for zero-latency live visual response
    const tokens = deriveFullThemeTokens({
      primary: palette.primary,
      secondary: palette.secondary,
      accent: palette.accent,
      background: palette.background,
      foreground: palette.foreground,
      gold: palette.gold,
    });
    applyThemeTokensToDOM(tokens);

    // 2. Automatically save immediately to the backend
    performSave({
      primaryColor: palette.primary,
      secondaryColor: palette.secondary,
      accentColor: palette.accent,
      backgroundColor: palette.background,
      foregroundColor: palette.foreground,
      goldColor: palette.gold,
    });
  }

  function resetToDefaultPalette() {
    applyPalette(ORIGINAL_DEFAULT_PALETTE);
  }

  function handleCustomColorChange(
    key: "primary" | "secondary" | "accent" | "foreground" | "background" | "gold",
    value: string,
  ) {
    let nextPrimary = primaryColor;
    let nextSecondary = secondaryColor;
    let nextAccent = accentColor;
    let nextForeground = foregroundColor;
    let nextBackground = backgroundColor;
    let nextGold = goldColor;

    if (key === "primary") {
      setPrimaryColor(value);
      nextPrimary = value;
    } else if (key === "secondary") {
      setSecondaryColor(value);
      nextSecondary = value;
    } else if (key === "accent") {
      setAccentColor(value);
      nextAccent = value;
    } else if (key === "foreground") {
      setForegroundColor(value);
      nextForeground = value;
    } else if (key === "background") {
      setBackgroundColor(value);
      nextBackground = value;
    } else if (key === "gold") {
      setGoldColor(value);
      nextGold = value;
    }

    // Instant DOM update & global context broadcast
    updateConfigOptimistic({
      primaryColor: nextPrimary,
      secondaryColor: nextSecondary,
      accentColor: nextAccent,
      backgroundColor: nextBackground,
      foregroundColor: nextForeground,
      goldColor: nextGold,
    });

    const tokens = deriveFullThemeTokens({
      primary: nextPrimary,
      secondary: nextSecondary,
      accent: nextAccent,
      background: nextBackground,
      foreground: nextForeground,
      gold: nextGold,
    });
    applyThemeTokensToDOM(tokens);

    // Debounced automatic save
    triggerDebouncedAutoSave(
      {
        primaryColor: nextPrimary,
        secondaryColor: nextSecondary,
        accentColor: nextAccent,
        backgroundColor: nextBackground,
        foregroundColor: nextForeground,
        goldColor: nextGold,
      },
      500,
    );
  }

  return (
    <Card className="mt-8 border-border/70 shadow-soft">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Business Identity, Branding, Colors & Legal Policies
            </CardTitle>
            <CardDescription className="text-xs">
              Manage platform favicon, custom primary/secondary theme colors, business identity, and
              Markdown-formatted Terms & Privacy policies.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LucideLoader className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs defaultValue="branding" className="w-full">
              <TabsList className="grid grid-cols-4 w-full text-xs h-fit">
                <TabsTrigger value="branding" className="py-2.5 gap-2 text-xs font-medium">
                  <Building2 className="h-3.5 w-3.5" />
                  Branding & Favicon
                </TabsTrigger>
                <TabsTrigger value="colors" className="py-2.5 gap-2 text-xs font-medium">
                  <Palette className="h-3.5 w-3.5" />
                  Brand Colors
                </TabsTrigger>
                <TabsTrigger value="terms" className="py-2.5 gap-2 text-xs font-medium">
                  <FileText className="h-3.5 w-3.5" />
                  Terms & Conditions
                </TabsTrigger>
                <TabsTrigger value="privacy" className="py-2.5 gap-2 text-xs font-medium">
                  <Shield className="h-3.5 w-3.5" />
                  Privacy Policy
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: BRANDING & FAVICON */}
              <TabsContent value="branding" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="b-name" className="text-xs font-semibold">
                      Business / App Name *
                    </Label>
                    <Input
                      id="b-name"
                      placeholder="e.g. Apex Credit"
                      value={businessName}
                      onChange={(e) => {
                        setBusinessName(e.target.value);
                        triggerDebouncedAutoSave({ businessName: e.target.value });
                      }}
                      onBlur={() => triggerDebouncedAutoSave({ businessName }, 50)}
                      required
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="b-location" className="text-xs font-semibold">
                      Business Location *
                    </Label>
                    <Input
                      id="b-location"
                      placeholder="e.g. Nairobi, Kenya"
                      value={businessLocation}
                      onChange={(e) => {
                        setBusinessLocation(e.target.value);
                        triggerDebouncedAutoSave({ businessLocation: e.target.value });
                      }}
                      onBlur={() => triggerDebouncedAutoSave({ businessLocation }, 50)}
                      required
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* LOGO UPLOAD & URL */}
                  <div className="space-y-2 rounded-xl border p-3.5 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="b-logo"
                        className="text-xs font-semibold flex items-center gap-1.5"
                      >
                        <ImageIcon className="h-3.5 w-3.5 text-primary" />
                        App Logo Asset
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsLogoDialogOpen(true)}
                        className="text-xs h-7 gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                      >
                        <Upload className="h-3 w-3" />
                        Upload / Pick Logo
                      </Button>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div
                        onClick={() => setIsLogoDialogOpen(true)}
                        className="size-8 rounded-full border bg-background flex items-center justify-center cursor-pointer hover:border-primary transition-colors shrink-0"
                        title="Click to change logo"
                      >
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt="Logo preview"
                            className="h-full w-full object-cover rounded-full"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <span className="text-[10px] font-bold text-primary">DEFAULT</span>
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <Input
                          id="b-logo"
                          placeholder="e.g. /api/uploads/logo-... or https://..."
                          value={logoUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLogoUrl(val);
                            updateConfigOptimistic({ logoUrl: val });
                            notifyConfigChanged({ logoUrl: val });
                            triggerDebouncedAutoSave({ logoUrl: val });
                          }}
                          onBlur={() => triggerDebouncedAutoSave({ logoUrl }, 50)}
                          className="shadow-none text-xs h-8"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Shown on navbar & invoices. Uploaded files save to custom UPLOAD_DIR.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* FAVICON UPLOAD & URL */}
                  <div className="space-y-2 rounded-xl border p-3.5 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="b-favicon"
                        className="text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        App Favicon Asset
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsFaviconDialogOpen(true)}
                        className="text-xs h-7 gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                      >
                        <Upload className="h-3 w-3" />
                        Upload / Pick Favicon
                      </Button>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div
                        onClick={() => setIsFaviconDialogOpen(true)}
                        className="size-8 rounded bg-background p-1 border flex items-center justify-center cursor-pointer hover:border-primary transition-colors shrink-0"
                        title="Click to change favicon"
                      >
                        {faviconUrl ? (
                          <img
                            src={faviconUrl}
                            alt="Favicon preview"
                            className="object-cover w-full h-full"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <span className="text-[10px] font-bold text-primary">ICO</span>
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <Input
                          id="b-favicon"
                          placeholder="e.g. /api/uploads/favicon-... or https://..."
                          value={faviconUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFaviconUrl(val);
                            updateConfigOptimistic({ faviconUrl: val });
                            notifyConfigChanged({ faviconUrl: val });
                            triggerDebouncedAutoSave({ faviconUrl: val });
                          }}
                          onBlur={() => triggerDebouncedAutoSave({ faviconUrl }, 50)}
                          className="text-xs shadow-none h-8"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Shown in browser tabs & bookmarks. Replaces previous upload.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {(logoUrl || faviconUrl) && (
                  <div className="p-3 rounded-lg border bg-muted/30 flex items-center gap-6">
                    {logoUrl && (
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-background border flex items-center justify-center overflow-hidden">
                          <img
                            src={logoUrl}
                            alt="Logo preview"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                        <div>
                          <div className="text-xs font-medium">Header Logo Active</div>
                          <div className="text-[10px] text-muted-foreground">
                            Rendered in real-time across the navbar.
                          </div>
                        </div>
                      </div>
                    )}

                    {faviconUrl && (
                      <div className="flex items-center gap-3 border-l pl-6">
                        <div className="size-8 rounded border flex items-center justify-center p-1 overflow-hidden">
                          <img
                            src={faviconUrl}
                            alt="Favicon preview"
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                        <div>
                          <div className="text-xs font-medium">Browser Favicon Active</div>
                          <div className="text-[10px] text-muted-foreground">
                            Updated dynamically in browser tab.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="b-phone" className="text-xs font-semibold">
                      Support Phone Number
                    </Label>
                    <Input
                      id="b-phone"
                      placeholder="e.g. +254 700 000 000"
                      value={supportPhone}
                      onChange={(e) => {
                        setSupportPhone(e.target.value);
                        triggerDebouncedAutoSave({ supportPhone: e.target.value });
                      }}
                      onBlur={() => triggerDebouncedAutoSave({ supportPhone }, 50)}
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="b-email" className="text-xs font-semibold">
                      Support Email Address
                    </Label>
                    <Input
                      id="b-email"
                      placeholder="e.g. support@yourdomain.com"
                      value={supportEmail}
                      onChange={(e) => {
                        setSupportEmail(e.target.value);
                        triggerDebouncedAutoSave({ supportEmail: e.target.value });
                      }}
                      onBlur={() => triggerDebouncedAutoSave({ supportEmail }, 50)}
                      className="text-sm"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: BRAND COLORS */}
              <TabsContent value="colors" className="space-y-5 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Preset Theme Palettes</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Click any preset palette to instantly apply and auto-save coordinated color
                      tokens across the entire platform.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetToDefaultPalette}
                    className="text-xs gap-1.5 h-8 shrink-0"
                  >
                    <LucideLoader className="h-3 w-3" />
                    Reset to Default Original Palette
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PRESET_THEME_PALETTES.map((preset) => {
                    const isSelected =
                      primaryColor === preset.primary &&
                      secondaryColor === preset.secondary &&
                      accentColor === preset.accent;

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPalette(preset)}
                        className={`flex flex-col items-start p-3.5 rounded-xl border transition-all text-left group relative ${
                          isSelected
                            ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                            : "border-border/70 bg-card hover:bg-muted/40 hover:border-primary/40"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2.5 right-2.5 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                            <Check className="size-3" />
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mb-2.5 w-full">
                          <span
                            title="Primary"
                            className="size-5 rounded-md border shadow-2xs"
                            style={{ backgroundColor: preset.primary }}
                          />
                          <span
                            title="Secondary"
                            className="size-5 rounded-md border shadow-2xs"
                            style={{ backgroundColor: preset.secondary }}
                          />
                          <span
                            title="Accent"
                            className="size-5 rounded-md border shadow-2xs"
                            style={{ backgroundColor: preset.accent }}
                          />
                          <span
                            title="Muted Canvas"
                            className="size-5 rounded-md border shadow-2xs"
                            style={{ backgroundColor: preset.muted }}
                          />
                          <span
                            title="Gold Accent"
                            className="size-5 rounded-md border shadow-2xs"
                            style={{ backgroundColor: preset.gold }}
                          />
                          <span
                            title="Dark Text"
                            className="size-5 rounded-md border shadow-2xs"
                            style={{ backgroundColor: preset.foreground }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                          {preset.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                          {preset.description}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-foreground">
                      Custom Color Overrides
                    </h4>
                    <span className="text-[11px] text-muted-foreground">
                      Changes apply live and auto-save automatically
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Primary */}
                    <div className="space-y-1.5 border p-3 rounded-lg bg-card">
                      <Label className="text-xs font-semibold flex items-center justify-between">
                        <span>Primary Color</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {primaryColor}
                        </span>
                      </Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={primaryColor.startsWith("#") ? primaryColor : "#047857"}
                          onChange={(e) => handleCustomColorChange("primary", e.target.value)}
                          className="size-9 rounded cursor-pointer border p-0.5"
                        />
                        <Input
                          value={primaryColor}
                          onChange={(e) => handleCustomColorChange("primary", e.target.value)}
                          className="text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* Secondary */}
                    <div className="space-y-1.5 border p-3 rounded-lg bg-card">
                      <Label className="text-xs font-semibold flex items-center justify-between">
                        <span>Secondary Color</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {secondaryColor}
                        </span>
                      </Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={secondaryColor.startsWith("#") ? secondaryColor : "#065f46"}
                          onChange={(e) => handleCustomColorChange("secondary", e.target.value)}
                          className="size-9 rounded cursor-pointer border p-0.5"
                        />
                        <Input
                          value={secondaryColor}
                          onChange={(e) => handleCustomColorChange("secondary", e.target.value)}
                          className="text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* Accent */}
                    <div className="space-y-1.5 border p-3 rounded-lg bg-card">
                      <Label className="text-xs font-semibold flex items-center justify-between">
                        <span>Accent Color</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {accentColor}
                        </span>
                      </Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={accentColor.startsWith("#") ? accentColor : "#10b981"}
                          onChange={(e) => handleCustomColorChange("accent", e.target.value)}
                          className="size-9 rounded cursor-pointer border p-0.5"
                        />
                        <Input
                          value={accentColor}
                          onChange={(e) => handleCustomColorChange("accent", e.target.value)}
                          className="text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* Foreground */}
                    <div className="space-y-1.5 border p-3 rounded-lg bg-card">
                      <Label className="text-xs font-semibold flex items-center justify-between">
                        <span>Foreground Text</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {foregroundColor}
                        </span>
                      </Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={foregroundColor.startsWith("#") ? foregroundColor : "#0f172a"}
                          onChange={(e) => handleCustomColorChange("foreground", e.target.value)}
                          className="size-9 rounded cursor-pointer border p-0.5"
                        />
                        <Input
                          value={foregroundColor}
                          onChange={(e) => handleCustomColorChange("foreground", e.target.value)}
                          className="text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* Background */}
                    <div className="space-y-1.5 border p-3 rounded-lg bg-card">
                      <Label className="text-xs font-semibold flex items-center justify-between">
                        <span>Background Canvas</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {backgroundColor}
                        </span>
                      </Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={backgroundColor.startsWith("#") ? backgroundColor : "#f8fafc"}
                          onChange={(e) => handleCustomColorChange("background", e.target.value)}
                          className="size-9 rounded cursor-pointer border p-0.5"
                        />
                        <Input
                          value={backgroundColor}
                          onChange={(e) => handleCustomColorChange("background", e.target.value)}
                          className="text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* Gold */}
                    <div className="space-y-1.5 border p-3 rounded-lg bg-card">
                      <Label className="text-xs font-semibold flex items-center justify-between">
                        <span>Gold Accent</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {goldColor}
                        </span>
                      </Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={goldColor.startsWith("#") ? goldColor : "#d97706"}
                          onChange={(e) => handleCustomColorChange("gold", e.target.value)}
                          className="size-9 rounded cursor-pointer border p-0.5"
                        />
                        <Input
                          value={goldColor}
                          onChange={(e) => handleCustomColorChange("gold", e.target.value)}
                          className="text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: TERMS AND CONDITIONS */}
              <TabsContent value="terms" className="space-y-3 pt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="terms-content"
                      className="text-xs font-semibold flex items-center gap-1.5"
                    >
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      Terms & Conditions (Markdown with Icon Support)
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTermsContent(DEFAULT_TERMS_MARKDOWN);
                          triggerDebouncedAutoSave({ termsContent: DEFAULT_TERMS_MARKDOWN }, 50);
                        }}
                        className="h-7 text-xs gap-1"
                      >
                        <LucideLoader className="h-3 w-3" /> Reset Default
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setPreviewTerms(!previewTerms)}
                        className="h-7 text-xs gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        {previewTerms ? "Edit Code" : "Live Preview"}
                      </Button>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Use standard Markdown syntax (`#`, `##`, `-`, `**`) and icon tags like
                    `[icon:shield]`, `[icon:scale]`, `[icon:check-circle]`, `[icon:dollar-sign]`,
                    `[icon:lock]` for inline icons. Auto-saved as you type.
                  </p>

                  {previewTerms ? (
                    <div className="p-4 border rounded-lg bg-card min-h-[280px]">
                      <MarkdownRenderer content={termsContent} />
                    </div>
                  ) : (
                    <IconAutocompleteTextarea
                      id="terms-content"
                      value={termsContent}
                      onValueChange={(val) => {
                        setTermsContent(val);
                        triggerDebouncedAutoSave({ termsContent: val }, 1000);
                      }}
                      rows={14}
                    />
                  )}
                </div>
              </TabsContent>

              {/* TAB 4: PRIVACY POLICY */}
              <TabsContent value="privacy" className="space-y-3 pt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="privacy-content"
                      className="text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      Privacy Policy (Markdown with Icon Support)
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPrivacyContent(DEFAULT_PRIVACY_MARKDOWN);
                          triggerDebouncedAutoSave(
                            { privacyContent: DEFAULT_PRIVACY_MARKDOWN },
                            50,
                          );
                        }}
                        className="h-7 text-xs gap-1"
                      >
                        <LucideLoader className="h-3 w-3" /> Reset Default
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setPreviewPrivacy(!previewPrivacy)}
                        className="h-7 text-xs gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        {previewPrivacy ? "Edit Code" : "Live Preview"}
                      </Button>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Use standard Markdown syntax (`#`, `##`, `-`, `**`) and icon tags like
                    `[icon:shield]`, `[icon:lock]`, `[icon:eye]`, `[icon:file-text]`,
                    `[icon:user-check]` for inline icons. Auto-saved as you type.
                  </p>

                  {previewPrivacy ? (
                    <div className="p-4 border rounded-lg bg-card min-h-[280px]">
                      <MarkdownRenderer content={privacyContent} />
                    </div>
                  ) : (
                    <IconAutocompleteTextarea
                      id="privacy-content"
                      value={privacyContent}
                      onValueChange={(val) => {
                        setPrivacyContent(val);
                        triggerDebouncedAutoSave({ privacyContent: val }, 1000);
                      }}
                      rows={14}
                    />
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between">
              <Button type="submit" disabled={updateMutation.isPending} className="gap-2">
                {updateMutation.isPending ? (
                  <>
                    <LucideLoader className="h-4 w-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Immediately
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* LOGO UPLOAD DIALOG */}
        <ImageUploadDialog
          isOpen={isLogoDialogOpen}
          onOpenChange={setIsLogoDialogOpen}
          title="App Logo Asset Manager"
          description="Upload or specify a custom high-resolution logo for your platform header, navbar, and exported documents."
          assetType="logo"
          currentUrl={logoUrl}
          onSave={(newUrl) => {
            setLogoUrl(newUrl);
            updateConfigOptimistic({ logoUrl: newUrl });
            notifyConfigChanged({ logoUrl: newUrl });
            triggerDebouncedAutoSave({ logoUrl: newUrl }, 0);
          }}
          onLivePreview={(previewUrl) => {
            updateConfigOptimistic({ logoUrl: previewUrl });
          }}
        />

        {/* FAVICON UPLOAD DIALOG */}
        <ImageUploadDialog
          isOpen={isFaviconDialogOpen}
          onOpenChange={setIsFaviconDialogOpen}
          title="App Favicon Asset Manager"
          description="Upload or choose a square icon or brand mark to display in browser tabs, address bars, and bookmarks."
          currentUrl={faviconUrl}
          assetType="favicon"
          onSave={(newUrl) => {
            setFaviconUrl(newUrl);
            updateConfigOptimistic({ faviconUrl: newUrl });
            notifyConfigChanged({ faviconUrl: newUrl });
            triggerDebouncedAutoSave({ faviconUrl: newUrl }, 0);
          }}
          onLivePreview={(previewUrl) => {
            updateConfigOptimistic({ faviconUrl: previewUrl });
          }}
        />
      </CardContent>
    </Card>
  );
}
