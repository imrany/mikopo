import React, { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  Check,
  AlertCircle,
  LucideLoader,
  Plus,
  Pencil,
  Trash2,
  Layers,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { adminUploadImage } from "@/lib/upload.functions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  listHeroPresets,
  adminCreateHeroPreset,
  adminUpdateHeroPreset,
  adminDeleteHeroPreset,
} from "@/lib/hero-presets.functions";
import type { HeroImagePreset } from "@/lib/brand-presets";

interface HeroImageEditorProps {
  currentImage: string;
  defaultImage: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (imageUrl: string) => void | Promise<void>;
  onReset?: () => void;
  onLivePreview?: (imageUrl: string) => void;
}

export function HeroImageEditor({
  currentImage,
  defaultImage,
  isOpen,
  onOpenChange,
  onSave,
  onReset,
  onLivePreview,
}: HeroImageEditorProps) {
  const { token, isStaff } = useAuth();
  const queryClient = useQueryClient();

  const uploadFn = useServerFn(adminUploadImage);
  const listPresetsFn = useServerFn(listHeroPresets);
  const createPresetFn = useServerFn(adminCreateHeroPreset);
  const updatePresetFn = useServerFn(adminUpdateHeroPreset);
  const deletePresetFn = useServerFn(adminDeleteHeroPreset);

  // Fetch hero presets from the database
  const { data: presetsData, isLoading: isPresetsLoading } = useQuery({
    queryKey: ["hero-image-presets"],
    queryFn: async () => {
      const res = await listPresetsFn();
      return (res?.presets || []) as HeroImagePreset[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const presets = presetsData || [];

  const [selectedUrl, setSelectedUrl] = useState<string>(currentImage || defaultImage);
  const [customUrlInput, setCustomUrlInput] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("presets");
  const [previewError, setPreviewError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preset CRUD dialog state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetFormName, setPresetFormName] = useState("");
  const [presetFormCategory, setPresetFormCategory] = useState("Fintech");
  const [presetFormUrl, setPresetFormUrl] = useState("");
  const [presetFormDesc, setPresetFormDesc] = useState("");

  // Preset delete confirmation dialog state
  const [presetToDelete, setPresetToDelete] = useState<HeroImagePreset | null>(null);

  useEffect(() => {
    if (isOpen) {
      const active = currentImage || defaultImage;
      setSelectedUrl(active);
      setPreviewError(false);

      if (active && active !== defaultImage) {
        setCustomUrlInput(active);
      }
    }
  }, [isOpen, currentImage, defaultImage]);

  const updateSelectedUrl = (newUrl: string) => {
    setSelectedUrl(newUrl);
    setPreviewError(false);
    if (onLivePreview) {
      onLivePreview(newUrl);
    }
  };

  // --- MUTATIONS FOR HERO PRESETS CRUD IN DATABASE ---

  const createMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      category: string;
      url: string;
      description?: string;
    }) => {
      return await createPresetFn({
        data: payload,
        headers: { authorization: `Bearer ${token}` },
      });
    },
    onSuccess: (res) => {
      if (res?.preset) {
        toast.success(`Preset "${res.preset.name}" saved to database`);
        void queryClient.invalidateQueries({ queryKey: ["hero-image-presets"] });
        updateSelectedUrl(res.preset.url);
        setIsFormModalOpen(false);
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create hero preset");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      name: string;
      category: string;
      url: string;
      description?: string;
    }) => {
      return await updatePresetFn({
        data: payload,
        headers: { authorization: `Bearer ${token}` },
      });
    },
    onSuccess: (res) => {
      if (res?.preset) {
        toast.success(`Preset "${res.preset.name}" updated in database`);
        void queryClient.invalidateQueries({ queryKey: ["hero-image-presets"] });
        if (selectedUrl === presetFormUrl || editingPresetId === res.preset.id) {
          updateSelectedUrl(res.preset.url);
        }
        setIsFormModalOpen(false);
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update hero preset");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await deletePresetFn({
        data: { id },
        headers: { authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      toast.success("Preset removed from database");
      void queryClient.invalidateQueries({ queryKey: ["hero-image-presets"] });
      setPresetToDelete(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete hero preset");
    },
  });

  // --- ACTIONS ---

  const handleOpenAddPreset = () => {
    setEditingPresetId(null);
    setPresetFormName("");
    setPresetFormCategory("Fintech");
    setPresetFormUrl("");
    setPresetFormDesc("");
    setIsFormModalOpen(true);
  };

  const handleOpenEditPreset = (preset: HeroImagePreset, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPresetId(preset.id);
    setPresetFormName(preset.name);
    setPresetFormCategory(preset.category || "Fintech");
    setPresetFormUrl(preset.url);
    setPresetFormDesc(preset.description || "");
    setIsFormModalOpen(true);
  };

  const handlePromptDeletePreset = (preset: HeroImagePreset, e: React.MouseEvent) => {
    e.stopPropagation();
    setPresetToDelete(preset);
  };

  const handleConfirmDelete = () => {
    if (!presetToDelete) return;
    deleteMutation.mutate(presetToDelete.id);
  };

  const handleSubmitPresetForm = (e: React.FormEvent) => {
    e.preventDefault();
    const name = presetFormName.trim();
    const category = presetFormCategory.trim() || "Fintech";
    const url = presetFormUrl.trim();
    const description = presetFormDesc.trim();

    if (!name) {
      toast.error("Preset name is required");
      return;
    }

    if (editingPresetId) {
      updateMutation.mutate({
        id: editingPresetId,
        name,
        category,
        url,
        description,
      });
    } else {
      createMutation.mutate({
        name,
        category,
        url,
        description,
      });
    }
  };

  const handleFileProcess = async (file: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      toast.error("Unsupported format. Please upload JPG, PNG, WEBP, or SVG.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("File size exceeds 8MB limit. Please compress the hero graphic.");
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
              category: "hero",
              originalName: file.name,
              previousUrl: selectedUrl,
            },
            headers: { authorization: `Bearer ${token}` },
          });

          if (res?.ok && res.url) {
            updateSelectedUrl(res.url);
            toast.success("Hero image uploaded and applied!");
          } else {
            updateSelectedUrl(base64Data);
            toast.success("Hero image preview loaded from file");
          }
        } catch (err: any) {
          console.warn("[Upload Error]", err);
          updateSelectedUrl(base64Data);
          toast.success("Hero image preview loaded locally");
        } finally {
          setIsUploading(false);
        }
      } else {
        updateSelectedUrl(base64Data);
        toast.success("Hero image loaded from file");
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
    toast.success("Hero image URL applied to preview");
  };

  const handleResetToDefault = () => {
    if (onReset) {
      onReset();
    }
    updateSelectedUrl(defaultImage);
    setCustomUrlInput("");
    toast.info("Reverted to original default hero banner");
  };

  const handleSave = async () => {
    try {
      await onSave(selectedUrl);
      toast.success("Landing page hero graphic published!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update hero graphic");
    }
  };

  const isCurrentDefault = !selectedUrl || selectedUrl === defaultImage;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-6 overflow-y-auto">
          {/* Header */}
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ImageIcon className="size-5 text-primary" />
              Hero Image Editor
            </SheetTitle>
            <SheetDescription className="text-xs">
              Customize the prominent banner graphic displayed at the top of your landing page.
            </SheetDescription>
          </SheetHeader>

          {/* Scrollable Body Content */}
          <div className="space-y-6 py-2 flex-1">
            {/* Live Hero Banner Aspect Preview Frame */}
            <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                <span className="flex items-center gap-1.5">Live Hero Banner Preview</span>
                <div className="flex items-center gap-2">
                  {isCurrentDefault ? (
                    <Badge variant="outline" className="text-[10px]">
                      Default Graphic
                    </Badge>
                  ) : (
                    <Badge variant="gold" className="text-[10px]">
                      Custom Applied
                    </Badge>
                  )}
                  {previewError && (
                    <span className="text-[10px] text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> Image failed to load
                    </span>
                  )}
                </div>
              </div>

              {/* 16:9 / 21:9 Aspect Ratio Frame */}
              <div className="relative aspect-video sm:aspect-21/9 w-full rounded-lg overflow-hidden border bg-slate-950/90 shadow-xs flex items-center justify-center">
                {selectedUrl && !previewError ? (
                  <img
                    src={selectedUrl}
                    alt="Hero Preview"
                    className="h-full w-full object-cover transition-all duration-300"
                    onError={() => setPreviewError(true)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                    <ImageIcon className="size-10 mb-2 opacity-50 text-primary" />
                    <p className="text-xs font-semibold">No Image Selected or Image URL Broken</p>
                    <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                      Select a preset below or paste a direct URL
                    </p>
                  </div>
                )}

                {/* Subtle overlay watermark to simulate landing hero composition */}
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent pointer-events-none p-4 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-white/90 bg-black/50 backdrop-blur-xs px-2.5 py-1 rounded-md border border-white/10">
                      Landing Hero Preview
                    </span>
                  </div>
                  <div className="max-w-md text-white">
                    <p className="text-sm sm:text-base font-bold leading-tight drop-shadow-md">
                      Smart Microfinance & Instant Mobile Loans
                    </p>
                    <p className="text-xs text-white/80 drop-shadow-xs line-clamp-1 mt-0.5">
                      Fast disbursements directly to your phone via M-Pesa.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2">
                <TabsList className="grid grid-cols-3 w-full sm:w-auto bg-muted/60 p-1 rounded-xl">
                  <TabsTrigger value="presets" className="text-xs font-semibold gap-1.5 rounded-lg">
                    <Layers className="size-3.5" /> Presets ({presets.length})
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="text-xs font-semibold gap-1.5 rounded-lg">
                    <Upload className="size-3.5" /> Upload
                  </TabsTrigger>
                  <TabsTrigger value="url" className="text-xs font-semibold gap-1.5 rounded-lg">
                    <LinkIcon className="size-3.5" /> Direct URL
                  </TabsTrigger>
                </TabsList>

                {activeTab === "presets" && isStaff && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleOpenAddPreset}
                    className="h-8 text-xs font-semibold gap-1.5 rounded-lg shadow-xs self-end sm:self-auto"
                  >
                    <Plus className="size-3.5" /> Add Preset
                  </Button>
                )}
              </div>

              {/* TAB 1: CURATED DATABASE PRESETS */}
              <TabsContent value="presets" className="pt-2 space-y-3 focus-visible:outline-none">
                {isPresetsLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <LucideLoader className="size-6 animate-spin text-primary" />
                    <p className="text-xs">Loading presets...</p>
                  </div>
                ) : presets.length === 0 ? (
                  <div className="py-10 border border-dashed rounded-2xl text-center p-6 space-y-3 bg-muted/10">
                    <Layers className="size-8 mx-auto text-muted-foreground/50" />
                    <p className="text-xs text-muted-foreground">
                      No hero presets found in the database.
                    </p>
                    {isStaff && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleOpenAddPreset}
                        className="text-xs gap-1.5"
                      >
                        <Plus className="size-3.5" /> Create First Preset
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {presets.map((preset) => {
                      const effectiveUrl = preset.url || defaultImage;
                      const isSelected =
                        selectedUrl === effectiveUrl || (!preset.url && isCurrentDefault);

                      return (
                        <div
                          key={preset.id}
                          onClick={() => updateSelectedUrl(effectiveUrl)}
                          className={`group relative rounded-xl border p-3 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                            isSelected
                              ? "border-primary ring-2 ring-primary/30 bg-primary/5 shadow-sm"
                              : "border-border hover:border-primary/50 bg-card hover:bg-muted/20 shadow-2xs"
                          }`}
                        >
                          <div className="space-y-2.5">
                            {/* Preset Thumbnail Image */}
                            <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-slate-900 border border-border/80">
                              <img
                                src={effectiveUrl}
                                alt={preset.name}
                                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                              <div className="absolute top-2 left-2">
                                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-xs text-white border border-white/10">
                                  {preset.category || "Fintech"}
                                </span>
                              </div>

                              {isSelected && (
                                <div className="absolute top-2 right-2 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                                  <Check className="size-3 stroke-3" />
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div>
                              <h4 className="font-bold text-xs text-foreground line-clamp-1 group-hover:text-primary transition-colors font-display">
                                {preset.name}
                              </h4>
                              {preset.description && (
                                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                                  {preset.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Quick Staff Actions (Edit / Delete) */}
                          {isStaff && (
                            <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
                              <span className="font-mono text-[10px] opacity-70">
                                {preset.url ? "External Asset" : "Default Asset"}
                              </span>
                              <div className="flex items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={(e) => handleOpenEditPreset(preset, e)}
                                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      <Pencil className="size-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Edit preset</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={(e) => handlePromptDeletePreset(preset, e)}
                                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                      <Trash2 className="size-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Delete preset</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* TAB 2: UPLOAD FILE */}
              <TabsContent value="upload" className="pt-2 focus-visible:outline-none">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
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
                      ? "border-primary bg-primary/5 scale-[1.01]"
                      : "border-border hover:border-primary/60 hover:bg-muted/30"
                  }`}
                >
                  <div className="size-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shadow-xs border border-primary/20">
                    {isUploading ? (
                      <LucideLoader className="size-7 animate-spin" />
                    ) : (
                      <Upload className="size-7" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-foreground font-display">
                      {isUploading ? "Uploading Hero Image..." : "Click or Drag & Drop Hero Banner"}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Recommended: 1600×900 or 1200×630. Supports PNG, JPG, WEBP, and SVG (up to
                      8MB).
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploading}
                    className="mt-1 gap-1.5 rounded-lg border-border hover:border-gold/40"
                  >
                    <Upload className="size-3.5" /> Browse Computer
                  </Button>
                </div>
              </TabsContent>

              {/* TAB 3: DIRECT URL */}
              <TabsContent value="url" className="pt-2 space-y-3.5 focus-visible:outline-none">
                <div className="space-y-2 rounded-2xl border border-border p-4 bg-muted/20">
                  <Label htmlFor="hero-custom-url-input" className="text-xs font-semibold">
                    Direct Image URL (HTTPS)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="hero-custom-url-input"
                      type="url"
                      placeholder="https://images.unsplash.com/photo-..."
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
                    Paste a direct image link from Unsplash, Pexels, Cloudinary, AWS S3, or your
                    CDN.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sticky Sheet Footer */}
          <SheetFooter className="mt-auto pt-4 border-t flex flex-row items-center justify-between gap-2">
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

      {/* MODAL: ADD / EDIT HERO PRESET */}
      <Dialog open={isFormModalOpen} onOpenChange={setIsFormModalOpen}>
        <DialogContent className="max-w-md p-6 bg-card text-card-foreground rounded-2xl border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-display text-foreground flex items-center gap-2">
              {editingPresetId ? (
                <Pencil className="size-4 text-primary" />
              ) : (
                <Plus className="size-4 text-primary" />
              )}
              {editingPresetId ? "Edit Hero Image Preset" : "Add New Hero Image Preset"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This preset will be saved directly into the database and available for your landing
              banner.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitPresetForm} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="preset-name" className="text-xs font-semibold">
                Preset Title *
              </Label>
              <Input
                id="preset-name"
                required
                placeholder="e.g. Modern Mobile Banking Banner"
                value={presetFormName}
                onChange={(e) => setPresetFormName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="preset-category" className="text-xs font-semibold">
                Category Tag
              </Label>
              <Input
                id="preset-category"
                placeholder="e.g. Fintech, Microfinance, Payments, SME"
                value={presetFormCategory}
                onChange={(e) => setPresetFormCategory(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="preset-url" className="text-xs font-semibold">
                Image Link (HTTPS URL) *
              </Label>
              <Input
                id="preset-url"
                type="url"
                placeholder="https://images.unsplash.com/photo-..."
                value={presetFormUrl}
                onChange={(e) => setPresetFormUrl(e.target.value)}
                className="text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Leave empty only if referring to default system asset.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="preset-desc" className="text-xs font-semibold">
                Description / Context (Optional)
              </Label>
              <Textarea
                id="preset-desc"
                placeholder="Short description of the theme, tone, or visual focus..."
                value={presetFormDesc}
                onChange={(e) => setPresetFormDesc(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>

            {/* Thumbnail Preview in Form */}
            {presetFormUrl && (
              <div className="rounded-xl border border-border bg-muted/40 p-2.5 space-y-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                  Image URL Preview
                </span>
                <div className="aspect-video w-full rounded-lg overflow-hidden bg-black/50 border border-border">
                  <img
                    src={presetFormUrl}
                    alt="Preset preview"
                    className="h-full w-full object-cover"
                    onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="pt-3 border-t border-border flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFormModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="text-xs font-semibold gap-1.5 shadow-sm"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <LucideLoader className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                {editingPresetId ? "Update Preset" : "Save to Database"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG: DELETE PRESET CONFIRMATION */}
      <AlertDialog
        open={Boolean(presetToDelete)}
        onOpenChange={(open) => !open && setPresetToDelete(null)}
      >
        <AlertDialogContent className="max-w-md rounded-2xl border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="size-4" /> Delete Hero Preset?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete{" "}
              <strong className="text-foreground">{presetToDelete?.name}</strong> from the database?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Preset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
