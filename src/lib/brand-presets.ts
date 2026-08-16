/**
 * Curated Hero Image Presets for Mikopo Lending Platform.
 * Hero presets are stored and managed directly in the PostgreSQL database.
 */

export interface HeroImagePreset {
  id: string;
  name: string;
  category: string;
  url: string; // empty string means use system default hero graphic
  description?: string | null;
  sortOrder?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/**
 * Curated Default Hero Banners
 * High resolution (1600x900 / 1200x630) images optimized for fintech & microfinance.
 */
export const DEFAULT_HERO_PRESETS: HeroImagePreset[] = [
  {
    id: "preset-default",
    name: "Original 3D Microfinance Concept",
    category: "3D Illustration",
    url: "", // uses system default hero-image.png
    description: "Default sleek 3D banking and mobile phone visualization with emerald tones",
    sortOrder: 0,
  },
  {
    id: "preset-fintech-mobile",
    name: "Modern Mobile Finance & Payments",
    category: "Mobile Banking",
    url: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1600&q=80",
    description:
      "High-tech smartphone dashboard with digital transaction visuals and clean aesthetics",
    sortOrder: 1,
  },
  {
    id: "preset-kenyan-commerce",
    name: "Kenyan Merchant & SME Enterprise",
    category: "Business & Trade",
    url: "https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=1600&q=80",
    description:
      "Professional dynamic collaborative team evaluating financial analytics and growth",
    sortOrder: 2,
  },
  {
    id: "preset-digital-wallet",
    name: "Digital Wallet & Instant Payouts",
    category: "Payments",
    url: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1600&q=80",
    description:
      "Modern financial tech display with growth charts, transaction cards, and smart metrics",
    sortOrder: 3,
  },
  {
    id: "preset-community-growth",
    name: "Community Capital & Entrepreneurship",
    category: "Empowerment",
    url: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1600&q=80",
    description: "Vibrant entrepreneur receiving digital capital to expand local business ventures",
    sortOrder: 4,
  },
  {
    id: "preset-cyber-security",
    name: "Secure Encrypted Transactions",
    category: "Security",
    url: "https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=1600&q=80",
    description:
      "Fintech interface showing bank-grade encryption, digital safeguards, and compliance",
    sortOrder: 5,
  },
  {
    id: "preset-mobile-pos",
    name: "Tap & Pay Mobile POS Terminal",
    category: "Point of Sale",
    url: "https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=1600&q=80",
    description: "Direct contactless payment and instant cash receipt confirmation",
    sortOrder: 6,
  },
  {
    id: "preset-nairobi-tech",
    name: "Nairobi Silicon Savannah Skyline",
    category: "Regional Hub",
    url: "https://images.unsplash.com/photo-1611348586804-61bf6c080437?auto=format&fit=crop&w=1600&q=80",
    description: "Dynamic African financial hub skyline illuminated at twilight",
    sortOrder: 7,
  },
];

export const PRESET_HERO_IMAGES = DEFAULT_HERO_PRESETS;
