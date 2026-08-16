import { useNavigate } from "@tanstack/react-router";
import { Button } from "./ui/button";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { popPath } from "@/lib/app-history";

export default function BackButton({
  label,
  to,
  size,
  className,
}: {
  label: string;
  to?: string;
  size?: "default" | "sm" | "lg" | "xl" | "icon" | null;
  className?: string;
}) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const handleBack = () => {
    // Explicit destination always wins
    if (to) {
      navigate({ to });
      return;
    }

    const previous = popPath();
    const fallback = isAdmin ? "/admin" : "/dashboard";

    navigate({ to: (previous ?? fallback) as any });
  };

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={handleBack}
      className={cn("gap-2 text-muted-foreground", className)}
    >
      <ArrowLeft className="size-4" /> {label}
    </Button>
  );
}
