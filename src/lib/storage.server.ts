import fs from "fs";
import path from "path";
import sharp from "sharp";

/**
 * Custom Storage & Upload Server Utility
 * Stores uploaded images in the directory specified by UPLOAD_DIR (default: ./uploads).
 * Automatically converts uploaded assets (favicons, hero images, logos) to optimized PNG format.
 * Handles automatic previous-file deletion on replacement.
 */

export function getUploadDir(): string {
  const envDir = process.env.UPLOAD_DIR || "./uploads";
  const resolved = path.resolve(process.cwd(), envDir);
  return resolved;
}

export function ensureUploadDir(): string {
  const dir = getUploadDir();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    console.error(`[Storage Server] Failed to create upload directory "${dir}":`, err);
  }
  return dir;
}

export function sanitizeFilename(filename: string): string {
  // Remove any path traversal components, slashes, or query params
  const clean = filename.split("?")[0]?.split("#")[0] || "";
  const basename = path.basename(clean);
  return basename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function getMimeTypeFromExt(ext: string): string {
  const normalized = ext.toLowerCase().replace(/^\./, "");
  switch (normalized) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "ico":
      return "image/x-icon";
    case "gif":
      return "image/gif";
    case "avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}

export function getExtFromMimeType(mime: string): string {
  switch (mime.toLowerCase()) {
    case "image/png":
      return ".png";
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/svg+xml":
      return ".svg";
    case "image/x-icon":
    case "image/vnd.microsoft.icon":
    case "image/ico":
      return ".ico";
    case "image/gif":
      return ".gif";
    case "image/avif":
      return ".avif";
    default:
      return ".png";
  }
}

/**
 * Deletes a previously uploaded file from the storage directory.
 * Safely ignores external URLs or non-local upload paths.
 */
export function deleteUploadedFile(urlOrName: string | null | undefined): boolean {
  if (!urlOrName || typeof urlOrName !== "string") return false;

  // Only delete if it belongs to our uploads route (/api/uploads/ or /uploads/)
  const isUploadPath =
    urlOrName.startsWith("/api/uploads/") ||
    urlOrName.startsWith("/uploads/") ||
    urlOrName.includes("/api/uploads/") ||
    urlOrName.includes("/uploads/");

  if (!isUploadPath) {
    return false;
  }

  try {
    const rawName = urlOrName.split("/").pop() || "";
    const cleanName = sanitizeFilename(rawName);
    if (!cleanName || cleanName === "." || cleanName === "..") {
      return false;
    }

    const dir = getUploadDir();
    const targetPath = path.join(dir, cleanName);

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      console.log(`[Storage Server] Successfully deleted previous image: ${cleanName}`);
      return true;
    }
  } catch (err) {
    console.warn(`[Storage Server] Error deleting uploaded file "${urlOrName}":`, err);
  }

  return false;
}

export interface SaveImageOptions {
  base64Data: string;
  category?: "hero" | "logo" | "favicon" | "general";
  originalName?: string;
  previousUrl?: string;
}

/**
 * Saves and processes a base64 or Data-URI image to the custom UPLOAD_DIR on disk.
 * Converts favicons and hero images to optimized PNG format.
 * If previousUrl is specified and points to a local upload, the old file is deleted.
 */
export async function saveUploadedImage({
  base64Data,
  category = "general",
  originalName: _originalName,
  previousUrl,
}: SaveImageOptions): Promise<{ ok: boolean; url: string; error?: string }> {
  try {
    ensureUploadDir();

    // 1. Delete previous uploaded file if replaced
    if (previousUrl) {
      deleteUploadedFile(previousUrl);
    }

    let pureBase64 = base64Data;

    // Detect data URI prefix (e.g. data:image/png;base64,...)
    if (base64Data.startsWith("data:")) {
      const parts = base64Data.split(";base64,");
      pureBase64 = parts[1] || "";
    }

    const inputBuffer = Buffer.from(pureBase64, "base64");

    if (inputBuffer.length === 0) {
      return { ok: false, url: "", error: "Uploaded file is empty" };
    }

    // Maximum file size check (15MB)
    if (inputBuffer.length > 15 * 1024 * 1024) {
      return { ok: false, url: "", error: "Uploaded image exceeds the 15MB limit" };
    }

    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    let outputBuffer: Buffer;
    let fileName: string;

    if (category === "favicon") {
      // Standardize favicon into a crisp, high-resolution PNG (512x512 with transparency)
      fileName = `pwa-icon-${uniqueId}.png`;
      try {
        outputBuffer = await sharp(inputBuffer, { density: 300 })
          .resize(512, 512, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png({ quality: 100, compressionLevel: 9 })
          .toBuffer();
      } catch {
        // Fallback to direct PNG conversion if resizing fails
        outputBuffer = await sharp(inputBuffer).png().toBuffer();
      }

      // Also refresh public/pwa-icon.png and public/favicon.png
      try {
        const publicDir = path.resolve(process.cwd(), "public");
        if (fs.existsSync(publicDir)) {
          fs.writeFileSync(path.join(publicDir, "pwa-icon.png"), outputBuffer);
          const icon32 = await sharp(outputBuffer).resize(32, 32).png().toBuffer();
          fs.writeFileSync(path.join(publicDir, "favicon.png"), icon32);
          const icon192 = await sharp(outputBuffer).resize(192, 192).png().toBuffer();
          fs.writeFileSync(path.join(publicDir, "pwa-icon-192.png"), icon192);
        }
      } catch (e) {
        console.warn("[Storage Server] Could not sync favicon to public folder:", e);
      }
    } else if (category === "hero") {
      // Standardize hero image into optimized PNG format
      fileName = `hero-image-${uniqueId}.png`;
      try {
        outputBuffer = await sharp(inputBuffer)
          .resize(1600, 900, { fit: "inside", withoutEnlargement: true })
          .png({ quality: 90, compressionLevel: 8 })
          .toBuffer();
      } catch {
        outputBuffer = await sharp(inputBuffer).png().toBuffer();
      }

      // Also refresh public/hero-image.png for canonical OpenGraph/Twitter card crawlers
      try {
        const publicDir = path.resolve(process.cwd(), "public");
        if (fs.existsSync(publicDir)) {
          fs.writeFileSync(path.join(publicDir, "hero-image.png"), outputBuffer);
        }
      } catch (e) {
        console.warn("[Storage Server] Could not sync hero image to public folder:", e);
      }
    } else if (category === "logo") {
      // Convert brand logo to crisp PNG
      fileName = `logo-${uniqueId}.png`;
      try {
        outputBuffer = await sharp(inputBuffer)
          .resize(512, 512, { fit: "inside", withoutEnlargement: true })
          .png({ quality: 95 })
          .toBuffer();
      } catch {
        outputBuffer = await sharp(inputBuffer).png().toBuffer();
      }
    } else {
      // General image conversion to PNG
      fileName = `general-${uniqueId}.png`;
      try {
        outputBuffer = await sharp(inputBuffer).png().toBuffer();
      } catch {
        outputBuffer = inputBuffer;
        fileName = `general-${uniqueId}.png`;
      }
    }

    const destinationPath = path.join(getUploadDir(), fileName);
    await fs.promises.writeFile(destinationPath, outputBuffer);

    console.log(
      `[Storage Server] Saved & converted ${category} image to ${destinationPath} (${outputBuffer.length} bytes as PNG)`,
    );

    const publicUrl = `/api/uploads/${fileName}`;
    return { ok: true, url: publicUrl };
  } catch (error) {
    console.error("[Storage Server] Failed to save uploaded image:", error);
    return {
      ok: false,
      url: "",
      error: error instanceof Error ? error.message : "Failed to save image",
    };
  }
}

/**
 * Reads and serves a file from the upload directory.
 */
export async function getUploadedFileResponse(filename: string): Promise<Response> {
  const cleanName = sanitizeFilename(filename);
  if (!cleanName || cleanName === "." || cleanName === "..") {
    return new Response("Invalid file path", { status: 400 });
  }

  const dir = getUploadDir();
  const filePath = path.join(dir, cleanName);

  try {
    if (!fs.existsSync(filePath)) {
      return new Response("File Not Found", { status: 404 });
    }

    const buffer = await fs.promises.readFile(filePath);
    const ext = path.extname(cleanName);
    const contentType = getMimeTypeFromExt(ext);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    console.error(`[Storage Server] Error reading file ${cleanName}:`, err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
