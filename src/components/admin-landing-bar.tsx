import { useEffect, useRef } from "react";
import {
  Save,
  RotateCcw,
  LucideLoader,
  Sparkles,
  Globe,
  User,
  ShieldCheck,
  Layers,
  Image as ImageIcon,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useAppConfig } from "@/lib/config-context";
import { adminSaveLandingContent } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type LandingViewMode = "public" | "borrower" | "staff" | "all";

interface AdminLandingBarProps {
  hasUnsavedChanges: boolean;
  contentMap: Record<string, string>;
  onReset: () => void;
  onSaved: () => void;
  viewMode: LandingViewMode;
  onViewModeChange: (mode: LandingViewMode) => void;
  lockLandingEditMode?: boolean;
  onEditHeroImage?: () => void;
}

export function AdminLandingBar({
  hasUnsavedChanges,
  contentMap,
  onReset,
  onSaved,
  viewMode,
  onViewModeChange,
  lockLandingEditMode = false,
  onEditHeroImage,
}: AdminLandingBarProps) {
  const { token, isStaff } = useAuth();
  const queryClient = useQueryClient();
  const { notifyConfigChanged } = useAppConfig();
  const saveContentFn = useServerFn(adminSaveLandingContent);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const saveMutation = useMutation({
    mutationFn: (jsonString: string) =>
      saveContentFn({
        data: { landingContent: jsonString },
        headers: { authorization: `Bearer ${token}` },
      }),
    onSuccess: (res, jsonString) => {
      if (!res.ok) {
        toast.error("Failed to save landing page changes");
        return;
      }
      onSaved();
      notifyConfigChanged({ landingContent: jsonString });
      void queryClient.invalidateQueries({ queryKey: ["public-business-config"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Debounced auto-save whenever hasUnsavedChanges becomes true
  useEffect(() => {
    if (hasUnsavedChanges && isStaff && !lockLandingEditMode) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        saveMutation.mutate(JSON.stringify(contentMap));
      }, 1500);
    }
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [hasUnsavedChanges, contentMap, isStaff, lockLandingEditMode, saveMutation]);

  if (!isStaff || lockLandingEditMode) return null;

  const handleSave = () => {
    saveMutation.mutate(JSON.stringify(contentMap));
  };

  return (
    <div className="bg-sidebar text-sidebar-foreground border-b border-sidebar-border px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-gold/20 text-gold font-bold">
            <Sparkles className="size-3.5" />
          </span>
          <span className="font-semibold text-sidebar-foreground flex items-center gap-1.5 flex-wrap">
            Visual Page Editor
            {hasUnsavedChanges && (
              <span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning border border-warning/30 text-[10px]">
                Unsaved Changes
              </span>
            )}
          </span>
        </div>

        {/* View UI Perspective Switcher */}
        <div className="flex items-center gap-1 bg-foreground p-1 rounded-lg border border-sidebar-border shadow-xs">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onViewModeChange("public")}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
                  viewMode === "public"
                    ? "bg-gold text-gold-foreground font-semibold shadow-xs"
                    : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <Globe className="size-3" />
                Public Landing
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Preview how anonymous prospective borrowers experience the landing page
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onViewModeChange("borrower")}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
                  viewMode === "borrower"
                    ? "bg-gold text-gold-foreground font-semibold shadow-xs"
                    : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <User className="size-3" />
                Borrowers UI
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Preview borrower-specific guide and loan calculator guidance
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onViewModeChange("staff")}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
                  viewMode === "staff"
                    ? "bg-gold text-gold-foreground font-semibold shadow-xs"
                    : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <ShieldCheck className="size-3" />
                Staff UI
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Preview the administrator operational guide and workflow documentation
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onViewModeChange("all")}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
                  viewMode === "all"
                    ? "bg-gold text-gold-foreground font-semibold shadow-xs"
                    : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <Layers className="size-3" />
                Show All
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Display all sections simultaneously for comprehensive editing
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {onEditHeroImage && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onEditHeroImage}
                className="h-7 text-xs border-sidebar-border text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground gap-1"
              >
                <ImageIcon className="size-3 text-gold" /> Edit Hero Image
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Upload a new hero graphic or select from curated fintech presets
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="h-7 text-xs border-sidebar-border text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <RotateCcw className="size-3 mr-1" /> Reset Defaults
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Revert all custom text copy and images back to system defaults
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="gold"
              size="sm"
              onClick={handleSave}
              disabled={!hasUnsavedChanges || saveMutation.isPending || lockLandingEditMode}
              className="h-7 text-xs font-semibold gap-1.5 shadow-sm"
            >
              {saveMutation.isPending ? (
                <>
                  <LucideLoader className="size-3 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-3" />
                  Save Page Edits
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Save and publish all visual text and hero image changes immediately
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
