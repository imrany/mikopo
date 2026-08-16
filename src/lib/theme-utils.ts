// Theme Palette Definitions and Utilities
// The default palette matches the original Mikopo app design system in styles.css

export interface ThemePalette {
  id: string;
  name: string;
  description: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  border: string;
  input: string;
  ring: string;
  gold: string;
  goldForeground: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarAccent: string;
  sidebarBorder: string;
  gradientHero: string;
  gradientBrand: string;
  gradientGold: string;
  gradientSurface: string;
}

export const ORIGINAL_DEFAULT_PALETTE: ThemePalette = {
  id: "emerald-default",
  name: "Emerald Forest (Original Default)",
  description:
    "The original signature deep forest & emerald finance palette with warm gold accents.",
  primary: "oklch(0.48 0.13 159)", // #047857 / vibrant emerald
  primaryForeground: "oklch(0.985 0.01 150)",
  secondary: "oklch(0.95 0.02 155)",
  secondaryForeground: "oklch(0.31 0.06 160)",
  muted: "oklch(0.96 0.012 150)",
  mutedForeground: "oklch(0.52 0.03 158)",
  accent: "oklch(0.94 0.035 160)",
  accentForeground: "oklch(0.3 0.07 160)",
  background: "oklch(0.99 0.008 140)",
  foreground: "oklch(0.21 0.03 160)",
  card: "oklch(1 0 0)",
  cardForeground: "oklch(0.21 0.03 160)",
  border: "oklch(0.9 0.015 155)",
  input: "oklch(0.9 0.015 155)",
  ring: "oklch(0.48 0.13 159)",
  gold: "oklch(0.79 0.14 82)",
  goldForeground: "oklch(0.26 0.05 80)",
  sidebar: "oklch(0.24 0.045 162)",
  sidebarForeground: "oklch(0.94 0.015 150)",
  sidebarPrimary: "oklch(0.7 0.14 158)",
  sidebarAccent: "oklch(0.3 0.05 162)",
  sidebarBorder: "oklch(0.33 0.05 162)",
  gradientHero:
    "linear-gradient(135deg, oklch(0.26 0.06 163) 0%, oklch(0.37 0.11 160) 55%, oklch(0.48 0.13 165) 100%)",
  gradientBrand: "linear-gradient(120deg, oklch(0.48 0.13 159), oklch(0.66 0.13 172))",
  gradientGold: "linear-gradient(120deg, oklch(0.79 0.14 82), oklch(0.86 0.12 95))",
  gradientSurface: "linear-gradient(180deg, oklch(1 0 0), oklch(0.97 0.015 155))",
};

export const PRESET_THEME_PALETTES: ThemePalette[] = [
  ORIGINAL_DEFAULT_PALETTE,
  {
    id: "ocean-blue",
    name: "Deep Ocean Blue",
    description: "Refined navy, sapphire and royal blue with amber highlights.",
    primary: "oklch(0.48 0.18 250)", // #1d4ed8
    primaryForeground: "oklch(0.99 0.005 240)",
    secondary: "oklch(0.94 0.02 245)",
    secondaryForeground: "oklch(0.25 0.08 255)",
    muted: "oklch(0.95 0.015 245)",
    mutedForeground: "oklch(0.5 0.04 250)",
    accent: "oklch(0.92 0.04 245)",
    accentForeground: "oklch(0.25 0.08 255)",
    background: "oklch(0.99 0.005 240)",
    foreground: "oklch(0.18 0.04 255)",
    card: "oklch(1 0 0)",
    cardForeground: "oklch(0.18 0.04 255)",
    border: "oklch(0.89 0.02 245)",
    input: "oklch(0.89 0.02 245)",
    ring: "oklch(0.48 0.18 250)",
    gold: "oklch(0.79 0.15 75)",
    goldForeground: "oklch(0.25 0.05 75)",
    sidebar: "oklch(0.2 0.05 255)",
    sidebarForeground: "oklch(0.95 0.01 240)",
    sidebarPrimary: "oklch(0.65 0.16 250)",
    sidebarAccent: "oklch(0.28 0.06 255)",
    sidebarBorder: "oklch(0.3 0.05 255)",
    gradientHero:
      "linear-gradient(135deg, oklch(0.22 0.07 260) 0%, oklch(0.35 0.14 255) 55%, oklch(0.48 0.18 250) 100%)",
    gradientBrand: "linear-gradient(120deg, oklch(0.48 0.18 250), oklch(0.65 0.15 230))",
    gradientGold: "linear-gradient(120deg, oklch(0.79 0.15 75), oklch(0.86 0.13 90))",
    gradientSurface: "linear-gradient(180deg, oklch(1 0 0), oklch(0.96 0.015 245))",
  },
  {
    id: "royal-amethyst",
    name: "Royal Amethyst",
    description: "Luxurious purple, violet, and gold prestige theme.",
    primary: "oklch(0.48 0.19 300)", // #7e22ce
    primaryForeground: "oklch(0.99 0.005 300)",
    secondary: "oklch(0.94 0.025 305)",
    secondaryForeground: "oklch(0.28 0.09 300)",
    muted: "oklch(0.95 0.015 305)",
    mutedForeground: "oklch(0.5 0.04 300)",
    accent: "oklch(0.92 0.045 305)",
    accentForeground: "oklch(0.28 0.09 300)",
    background: "oklch(0.99 0.006 310)",
    foreground: "oklch(0.18 0.04 300)",
    card: "oklch(1 0 0)",
    cardForeground: "oklch(0.18 0.04 300)",
    border: "oklch(0.89 0.02 305)",
    input: "oklch(0.89 0.02 305)",
    ring: "oklch(0.48 0.19 300)",
    gold: "oklch(0.82 0.16 85)",
    goldForeground: "oklch(0.25 0.05 85)",
    sidebar: "oklch(0.22 0.06 300)",
    sidebarForeground: "oklch(0.95 0.01 300)",
    sidebarPrimary: "oklch(0.68 0.17 300)",
    sidebarAccent: "oklch(0.29 0.07 300)",
    sidebarBorder: "oklch(0.32 0.06 300)",
    gradientHero:
      "linear-gradient(135deg, oklch(0.22 0.07 300) 0%, oklch(0.36 0.15 300) 55%, oklch(0.48 0.19 300) 100%)",
    gradientBrand: "linear-gradient(120deg, oklch(0.48 0.19 300), oklch(0.66 0.16 330))",
    gradientGold: "linear-gradient(120deg, oklch(0.82 0.16 85), oklch(0.88 0.13 95))",
    gradientSurface: "linear-gradient(180deg, oklch(1 0 0), oklch(0.96 0.015 305))",
  },
  {
    id: "midnight-slate",
    name: "Midnight Slate",
    description: "High-contrast editorial graphite, steel, and crisp bronze.",
    primary: "oklch(0.38 0.04 240)", // #334155
    primaryForeground: "oklch(0.99 0.005 240)",
    secondary: "oklch(0.93 0.01 240)",
    secondaryForeground: "oklch(0.2 0.03 240)",
    muted: "oklch(0.94 0.01 240)",
    mutedForeground: "oklch(0.48 0.02 240)",
    accent: "oklch(0.9 0.02 240)",
    accentForeground: "oklch(0.2 0.03 240)",
    background: "oklch(0.985 0.005 240)",
    foreground: "oklch(0.15 0.02 240)",
    card: "oklch(1 0 0)",
    cardForeground: "oklch(0.15 0.02 240)",
    border: "oklch(0.87 0.01 240)",
    input: "oklch(0.87 0.01 240)",
    ring: "oklch(0.38 0.04 240)",
    gold: "oklch(0.76 0.13 70)",
    goldForeground: "oklch(0.22 0.04 70)",
    sidebar: "oklch(0.18 0.02 240)",
    sidebarForeground: "oklch(0.94 0.01 240)",
    sidebarPrimary: "oklch(0.6 0.05 240)",
    sidebarAccent: "oklch(0.25 0.03 240)",
    sidebarBorder: "oklch(0.28 0.02 240)",
    gradientHero:
      "linear-gradient(135deg, oklch(0.18 0.02 240) 0%, oklch(0.28 0.03 240) 55%, oklch(0.38 0.04 240) 100%)",
    gradientBrand: "linear-gradient(120deg, oklch(0.38 0.04 240), oklch(0.55 0.06 240))",
    gradientGold: "linear-gradient(120deg, oklch(0.76 0.13 70), oklch(0.84 0.1 85))",
    gradientSurface: "linear-gradient(180deg, oklch(1 0 0), oklch(0.96 0.008 240))",
  },
  {
    id: "crimson-ruby",
    name: "Crimson Ruby",
    description: "Bold scarlet, vermilion, and warm gold accents for dynamic engagement.",
    primary: "oklch(0.52 0.22 25)", // #b91c1c
    primaryForeground: "oklch(0.99 0.005 25)",
    secondary: "oklch(0.95 0.02 25)",
    secondaryForeground: "oklch(0.3 0.1 25)",
    muted: "oklch(0.95 0.012 25)",
    mutedForeground: "oklch(0.52 0.04 25)",
    accent: "oklch(0.93 0.04 25)",
    accentForeground: "oklch(0.3 0.1 25)",
    background: "oklch(0.99 0.005 25)",
    foreground: "oklch(0.2 0.04 25)",
    card: "oklch(1 0 0)",
    cardForeground: "oklch(0.2 0.04 25)",
    border: "oklch(0.9 0.02 25)",
    input: "oklch(0.9 0.02 25)",
    ring: "oklch(0.52 0.22 25)",
    gold: "oklch(0.8 0.15 75)",
    goldForeground: "oklch(0.25 0.05 75)",
    sidebar: "oklch(0.22 0.06 25)",
    sidebarForeground: "oklch(0.95 0.01 25)",
    sidebarPrimary: "oklch(0.68 0.18 25)",
    sidebarAccent: "oklch(0.28 0.07 25)",
    sidebarBorder: "oklch(0.32 0.06 25)",
    gradientHero:
      "linear-gradient(135deg, oklch(0.22 0.06 25) 0%, oklch(0.38 0.16 25) 55%, oklch(0.52 0.22 25) 100%)",
    gradientBrand: "linear-gradient(120deg, oklch(0.52 0.22 25), oklch(0.68 0.16 50))",
    gradientGold: "linear-gradient(120deg, oklch(0.8 0.15 75), oklch(0.86 0.12 90))",
    gradientSurface: "linear-gradient(180deg, oklch(1 0 0), oklch(0.96 0.015 25))",
  },
  {
    id: "sunset-amber",
    name: "Sunset Amber & Teal",
    description: "Deep teal foundation with radiant golden amber and copper highlights.",
    primary: "oklch(0.46 0.12 185)", // #0f766e
    primaryForeground: "oklch(0.99 0.005 185)",
    secondary: "oklch(0.94 0.02 185)",
    secondaryForeground: "oklch(0.28 0.07 185)",
    muted: "oklch(0.95 0.015 185)",
    mutedForeground: "oklch(0.5 0.03 185)",
    accent: "oklch(0.92 0.035 185)",
    accentForeground: "oklch(0.28 0.07 185)",
    background: "oklch(0.99 0.008 185)",
    foreground: "oklch(0.18 0.03 185)",
    card: "oklch(1 0 0)",
    cardForeground: "oklch(0.18 0.03 185)",
    border: "oklch(0.89 0.015 185)",
    input: "oklch(0.89 0.015 185)",
    ring: "oklch(0.46 0.12 185)",
    gold: "oklch(0.78 0.16 65)",
    goldForeground: "oklch(0.24 0.05 65)",
    sidebar: "oklch(0.22 0.05 185)",
    sidebarForeground: "oklch(0.95 0.01 185)",
    sidebarPrimary: "oklch(0.68 0.14 185)",
    sidebarAccent: "oklch(0.29 0.06 185)",
    sidebarBorder: "oklch(0.32 0.05 185)",
    gradientHero:
      "linear-gradient(135deg, oklch(0.22 0.05 185) 0%, oklch(0.35 0.1 185) 55%, oklch(0.46 0.12 185) 100%)",
    gradientBrand: "linear-gradient(120deg, oklch(0.46 0.12 185), oklch(0.65 0.14 150))",
    gradientGold: "linear-gradient(120deg, oklch(0.78 0.16 65), oklch(0.85 0.13 85))",
    gradientSurface: "linear-gradient(180deg, oklch(1 0 0), oklch(0.96 0.015 185))",
  },
];

/**
 * Derives comprehensive full-system CSS custom properties from custom color inputs or selected preset.
 */
export function deriveFullThemeTokens(custom: {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
  background?: string | null;
  foreground?: string | null;
  gold?: string | null;
}): Record<string, string> {
  const primary = custom.primary || ORIGINAL_DEFAULT_PALETTE.primary;
  const secondary = custom.secondary || ORIGINAL_DEFAULT_PALETTE.secondary;
  const accent = custom.accent || ORIGINAL_DEFAULT_PALETTE.accent;
  const background = custom.background || ORIGINAL_DEFAULT_PALETTE.background;
  const foreground = custom.foreground || ORIGINAL_DEFAULT_PALETTE.foreground;
  const gold = custom.gold || ORIGINAL_DEFAULT_PALETTE.gold;

  // Check if matches an existing preset
  const matchedPreset = PRESET_THEME_PALETTES.find(
    (p) =>
      p.primary === primary ||
      (p.primary.startsWith("#") &&
        primary.startsWith("#") &&
        p.primary.toLowerCase() === primary.toLowerCase()),
  );

  if (matchedPreset) {
    return {
      "--primary": matchedPreset.primary,
      "--primary-foreground": matchedPreset.primaryForeground,
      "--secondary": matchedPreset.secondary,
      "--secondary-foreground": matchedPreset.secondaryForeground,
      "--muted": matchedPreset.muted,
      "--muted-foreground": matchedPreset.mutedForeground,
      "--accent": matchedPreset.accent,
      "--accent-foreground": matchedPreset.accentForeground,
      "--background": matchedPreset.background,
      "--foreground": matchedPreset.foreground,
      "--card": matchedPreset.card,
      "--card-foreground": matchedPreset.cardForeground,
      "--border": matchedPreset.border,
      "--input": matchedPreset.input,
      "--ring": matchedPreset.ring,
      "--gold": matchedPreset.gold,
      "--gold-foreground": matchedPreset.goldForeground,
      "--sidebar": matchedPreset.sidebar,
      "--sidebar-foreground": matchedPreset.sidebarForeground,
      "--sidebar-primary": matchedPreset.sidebarPrimary,
      "--sidebar-accent": matchedPreset.sidebarAccent,
      "--sidebar-border": matchedPreset.sidebarBorder,
      "--gradient-hero": matchedPreset.gradientHero,
      "--gradient-brand": matchedPreset.gradientBrand,
      "--gradient-gold": matchedPreset.gradientGold,
      "--gradient-surface": matchedPreset.gradientSurface,
      "--shadow-glow": `0 8px 28px -2px color-mix(in srgb, ${matchedPreset.primary} 45%, transparent), 0 2px 10px color-mix(in srgb, ${matchedPreset.primary} 30%, transparent)`,
    };
  }

  // Otherwise, calculate dynamic harmonious variants for custom color selections
  return {
    "--primary": primary,
    "--ring": primary,
    "--secondary": secondary,
    "--accent": accent,
    "--background": background,
    "--foreground": foreground,
    "--card-foreground": foreground,
    "--gold": gold,
    "--gradient-brand": `linear-gradient(120deg, ${primary}, ${accent})`,
    "--gradient-hero": `linear-gradient(135deg, ${secondary} 0%, ${primary} 100%)`,
    "--gradient-gold": `linear-gradient(120deg, ${gold}, ${accent})`,
    "--shadow-glow": `0 8px 28px -2px color-mix(in srgb, ${primary} 45%, transparent), 0 2px 10px color-mix(in srgb, ${primary} 30%, transparent)`,
  };
}
