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
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-6 overflow-y-auto">
        {/* Header */}
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconComponent className="size-5 text-primary" />
            {title}
          </SheetTitle>
          <SheetDescription className="text-xs">{description}</SheetDescription>
        </SheetHeader>

        {/* Scrollable Content */}
        <div className="space-y-6 py-2 flex-1">
          {/* Asset Live Preview Frame */}
          <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">Live Context Preview</span>
              {isCurrentDefault ? (
                <Badge variant="outline" className="text-[10px]">
                  Default Asset
                </Badge>
              ) : (
                <Badge variant="gold" className="text-[10px]">
                  Custom Applied
                </Badge>
              )}
            </div>

            {assetType === "favicon" ? (
              <div className="flex flex-col gap-4">
                {/* Browser Tab Simulation Frame */}
                <div className="w-full rounded-lg border bg-background shadow-xs overflow-hidden">
                  <div className="bg-muted/60 px-3.5 py-2 border-b flex items-center gap-2 text-xs">
                    <div className="flex gap-1.5">
                      <div className="size-2.5 rounded-full bg-destructive/80" />
                      <div className="size-2.5 rounded-full bg-gold/80" />
                      <div className="size-2.5 rounded-full bg-primary/80" />
                    </div>
                    <div className="flex items-center gap-2 bg-background px-3 py-1 rounded-md text-[11px] font-semibold text-foreground max-w-60 truncate shadow-2xs border border-border/50">
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
                  <div className="px-3.5 py-2 text-[11px] text-muted-foreground flex items-center justify-between bg-muted/10">
                    <span className="font-mono text-[10px]">https://yourdomain.co.ke/app</span>
                    <span className="flex items-center gap-1 text-[10px] text-primary font-medium">
                      <ShieldCheck className="size-3" /> Secure Browser Context
                    </span>
                  </div>
                </div>

                {/* Scaled Multi-Resolution Preview Chips */}
                <div className="flex items-center gap-4 bg-background p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-lg border bg-muted/30 flex items-center justify-center p-2 shadow-2xs">
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
                    <div className="size-8 rounded-md border bg-muted/30 flex items-center justify-center p-1.5 shadow-2xs">
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
              <div className="rounded-lg border bg-background p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="size-14 rounded-lg border bg-muted/30 flex items-center justify-center p-2 shadow-2xs overflow-hidden">
                    {selectedUrl && !previewError ? (
                      <img
                        src={selectedUrl}
                        alt="Logo Preview"
                        className="max-h-full max-w-full object-contain"
                        onError={() => setPreviewError(true)}
                      />
                    ) : (
                      <Sparkles className="size-7 text-primary" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{appName}</h4>
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
            <TabsList className="grid grid-cols-2 w-full bg-muted/60 p-1 rounded-lg">
              <TabsTrigger value="upload" className="text-xs font-semibold gap-1.5">
                <Upload className="size-3.5" /> Upload File
              </TabsTrigger>
              <TabsTrigger value="url" className="text-xs font-semibold gap-1.5">
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
                className={`border-2 border-dashed rounded-xl p-8 sm:p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3.5 ${
                  isDragOver
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : "border-border hover:border-primary/60 hover:bg-muted/30"
                }`}
              >
                <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shadow-xs">
                  {isUploading ? (
                    <LucideLoader className="size-6 animate-spin" />
                  ) : (
                    <Upload className="size-6" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-sm text-foreground">
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
                  className="mt-1 gap-1.5 text-xs"
                >
                  <Upload className="size-3.5" />
                  Browse Files
                </Button>
              </div>
            </TabsContent>

            {/* TAB: DIRECT URL */}
            <TabsContent value="url" className="pt-2 space-y-3.5 focus-visible:outline-none">
              <div className="space-y-2 rounded-xl border p-4 bg-muted/20">
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
        <SheetFooter className="mt-auto pt-4 border-t flex flex-row items-center justify-between gap-2">
          <div>
            {defaultUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetToDefault}
                className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3.5" />
                Reset Default
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              <X className="size-4 mr-1" />
              Cancel
            </Button>
            <Button
              type="button"
              variant="gold"
              size="sm"
              onClick={handleSave}
              disabled={isUploading}
              className="text-xs font-semibold gap-1.5 shadow-xs"
            >
              {isUploading ? (
                <>
                  <LucideLoader className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
