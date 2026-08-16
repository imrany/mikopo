import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireCustomAuth } from "@/lib/auth-middleware";

const uploadImageSchema = z.object({
  base64Data: z.string().min(1, "Image data is required"),
  category: z.enum(["hero", "logo", "favicon", "general"]).default("general"),
  originalName: z.string().optional(),
  previousUrl: z.string().optional(),
});

export const adminUploadImage = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => uploadImageSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden: Staff privileges required to upload assets");
    }

    const { saveUploadedImage } = await import("./storage.server");

    const result = await saveUploadedImage({
      base64Data: data.base64Data,
      category: data.category,
      originalName: data.originalName,
      previousUrl: data.previousUrl,
    });

    if (!result.ok) {
      throw new Error(result.error || "Failed to save image");
    }

    return { ok: true as const, url: result.url };
  });

const deleteImageSchema = z.object({
  fileUrl: z.string().min(1, "File URL is required"),
});

export const adminDeleteImage = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => deleteImageSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden: Staff privileges required to delete assets");
    }

    const { deleteUploadedFile } = await import("./storage.server");
    const deleted = deleteUploadedFile(data.fileUrl);

    return { ok: true as const, deleted };
  });
