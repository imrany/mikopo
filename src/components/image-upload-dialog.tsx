import React, { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Upload,
  Link as LinkIcon,
  RotateCcw,
  Check,
  AlertCircle,
  LucideLoader,
  Globe,
  Sparkles,
  Image as ImageIcon,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { adminUploadImage } from "@/lib/upload.functions";

export type ImageAssetType = "logo" | "favicon" | "hero" | "general";

interface ImageUploadDialogProps {
  assetType: ImageAssetType;
  title: string;
  description: string;
  currentUrl: string;
  defaultUrl?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (newUrl: string) => void | Promise<void>;
  onReset?: () => void;
  onLivePreview?: (previewUrl: string) => void;
  appName?: string;
}

export function ImageUploadDialog({
  assetType,
  title,
  description,
  currentUrl,
  defaultUrl = "",
  isOpen,
  onOpenChange,
  onSave,
  onReset,
  onLivePreview,
  appName = "Lending Platform",
}: ImageUploadDialogProps) {
  const { token } = useAuth();
  const uploadFn = useServerFn(adminUploadImage);

  const [selectedUrl, setSelectedUrl] = useState<string>(currentUrl || defaultUrl);
  const [customUrlInput, setCustomUrlInput] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("upload");
  const [previewError, setPreviewError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const active = currentUrl || defaultUrl;
      setSelectedUrl(active);
      setPreviewError(false);

      if (
        active &&
        active !== defaultUrl &&
        !active.startsWith("data:") &&
        !active.startsWith("/api/uploads/") &&
        !active.startsWith("/uploads/")
      ) {
        setCustomUrlInput(active);
        setActiveTab("url");
      } else {
        setActiveTab("upload");
      }
    }
  }, [isOpen, currentUrl, defaultUrl]);

  const updateSelectedUrl = (newUrl: string) => {
    setSelectedUrl(newUrl);
    setPreviewError(false);
    if (onLivePreview) {
      onLivePreview(newUrl);
    }
  };

  const handleFileProcess = async (file: File) => {
    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/svg+xml",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ];

    if (!validTypes.includes(file.type) && !file.name.endsWith(".ico")) {
      toast.error("Unsupported file format. Please upload PNG, JPG, WEBP, SVG, or ICO.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB limit. Please optimize the image before uploading.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;

      if (token) {
        setIsUploading(true);
        try {
          const res = await uploadFn({
            data: {
              base64Data,
              category: assetType === "favicon" ? "favicon" : "logo",
              originalName: file.name,
              previousUrl: selectedUrl,
            },
            headers: { authorization: `Bearer ${token}` },
          });

          if (res?.ok && res.url) {
            updateSelectedUrl(res.url);
            toast.success("Image uploaded successfully!");
          } else {
            updateSelectedUrl(base64Data);
            toast.success("Image loaded as local preview");
          }
        } catch (err: any) {
          console.warn("[Upload Error]", err);
          updateSelectedUrl(base64Data);
          toast.success("Image loaded from device");
        } finally {
          setIsUploading(false);
        }
      } else {
        updateSelectedUrl(base64Data);
        toast.success("Image preview loaded from device");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileProcess(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFileProcess(file);
    }
  };

  const handleApplyUrl = () => {
    const trimmed = customUrlInput.trim();
    if (!trimmed) {
      toast.error("Please enter a valid image URL");
      return;
    }
    updateSelectedUrl(trimmed);
    toast.success("URL applied to preview");
  };

  const handleResetToDefault = () => {
    if (onReset) {
      onReset();
    }
    updateSelectedUrl(defaultUrl);
    setCustomUrlInput("");
    toast.info("Reverted to system default asset");
  };

  const handleSave = async () => {
    try {
      await onSave(selectedUrl);
      toast.success(`${assetType === "favicon" ? "Favicon" : "Logo"} updated successfully!`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update asset");
    }
  };

  const isCurrentDefault = !selectedUrl || selectedUrl === defaultUrl;

  const IconComponent = assetType === "favicon" ? Sparkles : ImageIcon;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col h-full bg-card text-card-foreground border-l border-border shadow-2xl overflow-hidden"
      >
        {/* Top Header */}
        <SheetHeader className="p-5 sm:p-6 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-gold/15 text-gold border border-gold/30 shadow-xs shrink-0">
              <IconComponent className="size-5" />
            </span>
            <div className="text-left">
              <SheetTitle className="text-lg sm:text-xl font-bold font-display text-foreground flex items-center gap-2">
                {title}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                {description}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Asset Live Preview Frame */}
          <div className="rounded-2xl border border-border bg-muted/30 p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="font-display flex items-center gap-1.5">
                <IconComponent className="size-4 text-gold" />
                Live Context Preview
              </span>
              {isCurrentDefault ? (
                <span className="text-[10px] font-medium text-muted-foreground px-2.5 py-0.5 rounded-full bg-background border border-border shadow-2xs">
                  Default Asset
                </span>
              ) : (
                <span className="text-[10px] font-medium text-gold px-2.5 py-0.5 rounded-full bg-gold/10 border border-gold/30 shadow-2xs">
                  Custom Applied
                </span>
              )}
            </div>

            {assetType === "favicon" ? (
              <div className="flex flex-col gap-4">
                {/* Browser Tab Simulation Frame */}
                <div className="w-full rounded-xl border border-border bg-background shadow-xs overflow-hidden">
                  <div className="bg-muted/80 px-3.5 py-2 border-b border-border flex items-center gap-2 text-xs">
                    <div className="flex gap-1.5">
                      <div className="size-2.5 rounded-full bg-red-400/80" />
                      <div className="size-2.5 rounded-full bg-yellow-400/80" />
                      <div className="size-2.5 rounded-full bg-green-400/80" />
                    </div>
                    <div className="flex items-center gap-2 bg-background px-3 py-1 rounded-md text-[11px] font-semibold text-foreground max-w-[240px] truncate shadow-2xs border border-border/50">
                      {selectedUrl && !previewError ? (
                        <img
                          src={selectedUrl}
                          alt="Favicon Tab"
                          className="size-4 object-contain shrink-0"
                          onError={() => setPreviewError(true)}
                        />
                      ) : (
                        <Globe className="size-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="truncate">{appName} — Portal</span>
                    </div>
                  </div>
                  <div className="px-3.5 py-2.5 text-[11px] text-muted-foreground flex items-center justify-between bg-muted/10">
                    <span className="font-mono text-[10px]">https://yourdomain.co.ke/app</span>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                      <ShieldCheck className="size-3" /> Secure Browser Context
                    </span>
                  </div>
                </div>

                {/* Scaled Multi-Resolution Preview Chips */}
                <div className="flex items-center gap-4 bg-background p-3 rounded-xl border border-border">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-xl border border-border bg-muted/30 flex items-center justify-center p-2 shadow-2xs">
                      {selectedUrl && !previewError ? (
                        <img
                          src={selectedUrl}
                          alt="Favicon 48px"
                          className="max-h-full max-w-full object-contain"
                          onError={() => setPreviewError(true)}
                        />
                      ) : (
                        <Globe className="size-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-foreground block">48×48 px</span>
                      <span className="text-[10px] text-muted-foreground">High-DPI Bookmark</span>
                    </div>
                  </div>

                  <div className="h-8 w-px bg-border mx-1" />

                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg border border-border bg-muted/30 flex items-center justify-center p-1.5 shadow-2xs">
                      {selectedUrl && !previewError ? (
                        <img
                          src={selectedUrl}
                          alt="Favicon 32px"
                          className="max-h-full max-w-full object-contain"
                          onError={() => setPreviewError(true)}
                        />
                      ) : (
                        <Globe className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-foreground block">32×32 px</span>
                      <span className="text-[10px] text-muted-foreground">Standard Tab</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Logo Preview Frame */
              <div className="rounded-xl border border-border bg-background p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="size-14 rounded-xl border border-border bg-muted/30 flex items-center justify-center p-2 shadow-2xs overflow-hidden">
                    {selectedUrl && !previewError ? (
                      <img
                        src={selectedUrl}
                        alt="Logo Preview"
                        className="max-h-full max-w-full object-contain"
                        onError={() => setPreviewError(true)}
                      />
                    ) : (
                      <Sparkles className="size-7 text-gold" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm font-display text-foreground">{appName}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Navbar header, invoice receipts & brand mark preview
                    </p>
                  </div>
                </div>
                {previewError && (
                  <span className="text-xs text-destructive flex items-center gap-1 font-medium">
                    <AlertCircle className="size-3.5" /> Invalid Image URL
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Sources Tabs: Upload vs Direct URL */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 w-full bg-muted/60 p-1 rounded-xl">
              <TabsTrigger value="upload" className="text-xs font-semibold gap-1.5 rounded-lg">
                <Upload className="size-3.5" /> Upload File
              </TabsTrigger>
              <TabsTrigger value="url" className="text-xs font-semibold gap-1.5 rounded-lg">
                <LinkIcon className="size-3.5" /> Direct URL
              </TabsTrigger>
            </TabsList>

            {/* TAB: UPLOAD FILE */}
            <TabsContent value="upload" className="pt-2 focus-visible:outline-none">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico"
                className="hidden"
              />
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3.5 ${
                  isDragOver
                    ? "border-gold bg-gold/5 scale-[1.01]"
                    : "border-border hover:border-gold/60 hover:bg-muted/30"
                }`}
              >
                <div className="size-14 rounded-2xl bg-gold/15 text-gold flex items-center justify-center shadow-xs border border-gold/20">
                  {isUploading ? (
                    <LucideLoader className="size-7 animate-spin" />
                  ) : (
                    <Upload className="size-7" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-sm text-foreground font-display">
                    {isUploading
                      ? "Uploading & Processing Image..."
                      : "Click or Drag & Drop image file"}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Supports PNG, JPG, WEBP, SVG, and ICO formats (up to 5MB)
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  className="mt-1 gap-1.5 rounded-lg border-border hover:border-gold/40"
                >
                  <Upload className="size-3.5" />
                  Browse Files
                </Button>
              </div>
            </TabsContent>

            {/* TAB: DIRECT URL */}
            <TabsContent value="url" className="pt-2 space-y-3.5 focus-visible:outline-none">
              <div className="space-y-2 rounded-2xl border border-border p-4 bg-muted/20">
                <Label htmlFor="custom-url-input" className="text-xs font-semibold">
                  HTTPS Image URL
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="custom-url-input"
                    type="url"
                    placeholder="https://example.com/brand-assets/logo.png"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    className="text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleApplyUrl();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleApplyUrl}
                    className="text-xs font-semibold shrink-0"
                  >
                    Apply URL
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Paste a direct secure link from Unsplash, Cloudinary, AWS S3, or your CDN.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sticky Sheet Footer */}
        <SheetFooter className="p-4 sm:p-5 border-t border-border bg-card flex flex-row items-center justify-between gap-3 mt-auto">
          <div>
            {defaultUrl && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetToDefault}
                    className="text-xs gap-1.5 text-muted-foreground hover:text-foreground rounded-lg"
                  >
                    <RotateCcw className="size-3.5" />
                    Reset Default
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Revert to original default asset</TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-lg"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="gold"
              size="sm"
              onClick={handleSave}
              disabled={isUploading}
              className="text-xs font-semibold gap-1.5 shadow-sm rounded-lg"
            >
              <Check className="size-3.5" />
              Save Asset
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
