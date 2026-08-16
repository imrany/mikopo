import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireCustomAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";
import { DEFAULT_HERO_PRESETS, HeroImagePreset } from "@/lib/brand-presets";

export const listHeroPresets = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const existing = await prisma.heroImagePreset.findMany({
      orderBy: { sortOrder: "asc" },
    });

    if (existing && existing.length > 0) {
      return { presets: existing as HeroImagePreset[] };
    }

    // Auto-seed defaults if table is empty
    const createdPresets: HeroImagePreset[] = [];
    for (const p of DEFAULT_HERO_PRESETS) {
      const created = await prisma.heroImagePreset.create({
        data: {
          id: p.id,
          name: p.name,
          category: p.category,
          url: p.url,
          description: p.description || "",
          sortOrder: p.sortOrder ?? 0,
        },
      });
      createdPresets.push(created as HeroImagePreset);
    }

    return { presets: createdPresets };
  } catch (err) {
    console.warn(
      "[HeroPresets] Error fetching hero presets from database, falling back to defaults:",
      err,
    );
    return { presets: DEFAULT_HERO_PRESETS };
  }
});

const heroPresetInputSchema = z.object({
  name: z.string().trim().min(1, "Preset name is required"),
  category: z.string().trim().default("Fintech"),
  url: z.string().trim().default(""),
  description: z.string().trim().optional(),
});

export const adminCreateHeroPreset = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => heroPresetInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden: Staff privileges required to manage hero presets");
    }

    const allPresets = await prisma.heroImagePreset.findMany({
      orderBy: { sortOrder: "desc" },
      take: 1,
    });
    const nextSortOrder = allPresets.length > 0 ? (allPresets[0].sortOrder || 0) + 1 : 0;

    const preset = await prisma.heroImagePreset.create({
      data: {
        name: data.name,
        category: data.category || "Fintech",
        url: data.url || "",
        description: data.description || "",
        sortOrder: nextSortOrder,
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          actorId: userId,
          action: "admin.hero_preset_created",
          targetType: "hero_preset",
          targetId: preset.id,
          details: JSON.stringify({ name: preset.name, url: preset.url }),
        },
      });
    } catch {
      // Non-blocking audit log
    }

    return { ok: true as const, preset: preset as HeroImagePreset };
  });

const updateHeroPresetSchema = z.object({
  id: z.string().min(1, "Preset ID is required"),
  name: z.string().trim().min(1, "Preset name is required"),
  category: z.string().trim().default("Fintech"),
  url: z.string().trim().default(""),
  description: z.string().trim().optional(),
});

export const adminUpdateHeroPreset = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => updateHeroPresetSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden: Staff privileges required to manage hero presets");
    }

    const updated = await prisma.heroImagePreset.update({
      where: { id: data.id },
      data: {
        name: data.name,
        category: data.category || "Fintech",
        url: data.url,
        description: data.description || "",
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          actorId: userId,
          action: "admin.hero_preset_updated",
          targetType: "hero_preset",
          targetId: updated.id,
          details: JSON.stringify({ name: updated.name, url: updated.url }),
        },
      });
    } catch {
      // Non-blocking audit log
    }

    return { ok: true as const, preset: updated as HeroImagePreset };
  });

export const adminDeleteHeroPreset = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden: Staff privileges required to manage hero presets");
    }

    await prisma.heroImagePreset.delete({
      where: { id: data.id },
    });

    try {
      await prisma.auditLog.create({
        data: {
          actorId: userId,
          action: "admin.hero_preset_deleted",
          targetType: "hero_preset",
          targetId: data.id,
        },
      });
    } catch {
      // Non-blocking audit log
    }

    return { ok: true as const };
  });

export const adminResetHeroPresets = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden: Staff privileges required to manage hero presets");
    }

    await prisma.heroImagePreset.deleteMany({});

    const createdPresets: HeroImagePreset[] = [];
    for (const p of DEFAULT_HERO_PRESETS) {
      const created = await prisma.heroImagePreset.create({
        data: {
          name: p.name,
          category: p.category,
          url: p.url,
          description: p.description || "",
          sortOrder: p.sortOrder ?? 0,
        },
      });
      createdPresets.push(created as HeroImagePreset);
    }

    try {
      await prisma.auditLog.create({
        data: {
          actorId: userId,
          action: "admin.hero_presets_reset",
          targetType: "hero_preset",
        },
      });
    } catch {
      // Non-blocking audit log
    }

    return { ok: true as const, presets: createdPresets };
  });
