import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppConfig } from "@/lib/config-context";

export function BrandMark({
  className,
  tone = "default",
}: {
  className?: string;
  tone?: "default" | "inverted";
}) {
  const { businessName, logoUrl } = useAppConfig();
  const [hasImageError, setHasImageError] = useState(false);

  // Reset error state whenever logoUrl changes in real time
  useEffect(() => {
    setHasImageError(false);
  }, [logoUrl]);

  const name = businessName || "";
  const showCustomLogo = Boolean(logoUrl && !hasImageError);

  return (
    <Link
      to="/"
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label={`${name} home`}
    >
      {showCustomLogo ? (
        <img
          key={logoUrl}
          src={logoUrl}
          alt={name}
          className="h-8 w-8 object-cover transition-opacity duration-300 rounded-full"
          onError={() => setHasImageError(true)}
        />
      ) : (
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-brand shadow-soft">
          <Coins className="size-5 text-primary-foreground" aria-hidden />
        </span>
      )}
      <span
        className={cn(
          "font-display text-lg font-semibold tracking-tight",
          tone === "inverted" ? "text-primary-foreground" : "text-foreground",
        )}
      >
        {name}
      </span>
    </Link>
  );
}
