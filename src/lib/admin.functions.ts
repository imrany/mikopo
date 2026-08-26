import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireCustomAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";
import { sendSystemAlertToAdmins, notifyUserAccountDeleted } from "@/lib/notifications.server";

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const { revertStuckDisbursingLoans } = await import("./loans.server");
    await revertStuckDisbursingLoans();

    const [totalUsers, suspended, settings, recentUsers] = await Promise.all([
      prisma.profile.count(),
      prisma.profile.count({ where: { status: "suspended" } }),
      prisma.businessSettings.findFirst(),
      prisma.profile.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          status: true,
          credibilityScore: true,
          loanLimit: true,
          createdAt: true,
          roles: { select: { role: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

    return {
      totalUsers,
      suspendedUsers: suspended,
      settings: settings
        ? {
            id: settings.id,
            business_name: settings.businessName,
            business_location: settings.businessLocation,
            support_phone: settings.supportPhone,
            support_email: settings.supportEmail,
            mpesa_shortcode: settings.mpesaShortcode,
            mpesa_account_number: settings.mpesaAccountNumber,
            mpesa_environment: settings.mpesaEnvironment,
            mpesa_callback_url: settings.mpesaCallbackUrl,
            currency: settings.currency,
            setup_completed: settings.setupCompleted,
            logo_url: settings.logoUrl,
            favicon_url: settings.faviconUrl,
            primary_color: settings.primaryColor,
            secondary_color: settings.secondaryColor,
            accent_color: settings.accentColor,
            background_color: settings.backgroundColor,
            foreground_color: settings.foregroundColor,
            gold_color: settings.goldColor,
            landing_content: settings.landingContent,
            terms_content: settings.termsContent,
            privacy_content: settings.privacyContent,
            min_credibility_score: settings.minCredibilityScore,
            max_credibility_score: settings.maxCredibilityScore,
          }
        : null,
      recentUsers: recentUsers.map((u) => {
        const isAdminOrAgent = u.roles.some((r) => r.role === "super_admin" || r.role === "staff");
        return {
          id: u.id,
          first_name: u.firstName,
          last_name: u.lastName,
          phone: u.phone,
          status: u.status,
          credibility_score: isAdminOrAgent ? 0 : u.credibilityScore,
          loan_limit: isAdminOrAgent ? 0 : Number(u.loanLimit),
          created_at: u.createdAt.toISOString(),
        };
      }),
    };
  });

const darajaSchema = z.object({
  environment: z.enum(["sandbox", "production"]),
  consumerKey: z.string().trim().min(1, "Consumer key is required"),
  consumerSecret: z.string().trim().min(1, "Consumer secret is required"),
  passkey: z.string().trim().min(1, "Passkey is required"),
  initiatorName: z.string().trim().min(1, "Initiator name is required"),
  securityCredential: z.string().trim().min(1, "Security credential is required"),
  mpesaShortcode: z.string().trim().optional(),
  mpesaAccountNumber: z.string().trim().optional(),
  mpesaCallbackUrl: z.string().trim().optional(),
});

export const getDarajaCredentials = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const [data, settings] = await Promise.all([
      prisma.darajaCredentials.findFirst(),
      prisma.businessSettings.findFirst(),
    ]);
    const configured = Boolean(data && data.consumerKey && data.consumerSecret && data.passkey);

    const rawEnv = data?.environment ?? settings?.mpesaEnvironment ?? "sandbox";
    const environment = rawEnv === "production" ? "production" : "sandbox";

    return {
      configured,
      environment,
      consumerKey: data?.consumerKey ?? "",
      consumerSecret: data?.consumerSecret ?? "",
      passkey: data?.passkey ?? "",
      initiatorName: data?.initiatorName ?? "",
      securityCredential: data?.securityCredential ?? "",
      mpesaShortcode: settings?.mpesaShortcode ?? "",
      mpesaAccountNumber: settings?.mpesaAccountNumber ?? "",
      mpesaCallbackUrl: settings?.mpesaCallbackUrl ?? "",
      updatedAt: data?.updatedAt ? data.updatedAt.toISOString() : null,
    };
  });

export const saveDarajaCredentials = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => darajaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const [existing, settings] = await Promise.all([
      prisma.darajaCredentials.findFirst({ select: { id: true } }),
      prisma.businessSettings.findFirst({
        select: { id: true, lockDarajaConfig: true },
      }),
    ]);

    if (settings?.lockDarajaConfig) {
      throw new Error(
        "Daraja M-Pesa credentials configuration is locked by Admin Rules. To make changes, unlock it in Admin Rules console.",
      );
    }

    const envToSave = data.environment;

    if (existing) {
      await prisma.darajaCredentials.update({
        where: { id: existing.id },
        data: {
          environment: envToSave,
          consumerKey: data.consumerKey,
          consumerSecret: data.consumerSecret,
          passkey: data.passkey,
          initiatorName: data.initiatorName,
          securityCredential: data.securityCredential,
          updatedBy: userId,
        },
      });
    } else {
      await prisma.darajaCredentials.create({
        data: {
          environment: envToSave,
          consumerKey: data.consumerKey,
          consumerSecret: data.consumerSecret,
          passkey: data.passkey,
          initiatorName: data.initiatorName,
          securityCredential: data.securityCredential,
          updatedBy: userId,
        },
      });
    }

    if (settings) {
      await prisma.businessSettings.update({
        where: { id: settings.id },
        data: {
          mpesaEnvironment: envToSave,
          ...(data.mpesaShortcode !== undefined
            ? { mpesaShortcode: data.mpesaShortcode || null }
            : {}),
          ...(data.mpesaAccountNumber !== undefined
            ? { mpesaAccountNumber: data.mpesaAccountNumber || null }
            : {}),
          ...(data.mpesaCallbackUrl !== undefined
            ? { mpesaCallbackUrl: data.mpesaCallbackUrl || null }
            : {}),
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "daraja.credentials_updated",
        targetType: "daraja_credentials",
        details: { environment: data.environment },
      },
    });

    return { ok: true as const };
  });

export const getDarajaEnvironment = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async () => {
    const { getActiveEnvironment } = await import("./loans.server");
    return { environment: await getActiveEnvironment() };
  });

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const [users, initialSuperAdmin] = await Promise.all([
      prisma.profile.findMany({
        include: {
          roles: true,
          loans: {
            select: { id: true, status: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.userRole.findFirst({
        where: { role: "super_admin" },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const activeLoanStatuses = [
      "pending_guarantors",
      "pending_approval",
      "approved",
      "disbursing",
      "active",
    ];

    return users.map((u) => {
      const staffRole = u.roles.find((r) => r.role === "staff");
      const isSuperAdmin = u.roles.some((r) => r.role === "super_admin");
      const isInitialAdmin = Boolean(initialSuperAdmin && initialSuperAdmin.userId === u.id);
      const isAgent = Boolean(staffRole);

      const hasDefaultedLoan = u.loans.some((l) => l.status === "defaulted");
      const hasActiveOrPendingLoan = u.loans.some((l) => activeLoanStatuses.includes(l.status));
      const isAdminOrAgent = isSuperAdmin || isInitialAdmin || isAgent;

      return {
        id: u.id,
        first_name: u.firstName,
        last_name: u.lastName,
        email: u.email,
        phone: u.phone,
        id_number: u.idNumber,
        status: u.status,
        credibility_score: isAdminOrAgent ? 0 : u.credibilityScore,
        loan_limit: isAdminOrAgent ? 0 : Number(u.loanLimit),
        is_earning_points_frozen: u.isEarningPointsFrozen,
        referral_code: u.referralCode,
        referred_by: u.referredBy,
        created_at: u.createdAt.toISOString(),
        is_agent: isAgent,
        is_super_admin: isSuperAdmin,
        is_initial_admin: isInitialAdmin,
        agent_permissions: staffRole ? staffRole.permissions : [],
        has_defaulted_loan: hasDefaultedLoan,
        has_active_or_pending_loan: hasActiveOrPendingLoan,
        is_eligible_for_agent:
          u.status === "active" && !hasDefaultedLoan && !hasActiveOrPendingLoan && !isAdminOrAgent,
      };
    });
  });

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  email: z.string().email().toLowerCase().optional(),
  phone: z.string().trim().min(9).max(15).optional(),
  idNumber: z.string().trim().min(4).max(20).optional(),
});

async function checkInitialAdminProtection(actorUserId: string, targetUserId: string) {
  const initialSuperAdmin = await prisma.userRole.findFirst({
    where: { role: "super_admin" },
    orderBy: { createdAt: "asc" },
  });

  if (initialSuperAdmin && initialSuperAdmin.userId === targetUserId) {
    if (actorUserId !== initialSuperAdmin.userId) {
      throw new Error(
        "Initial admin's details and points can never be edited or frozen by an agent. Only the initial admin account can modify their own account.",
      );
    }
  }
}

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => updateUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    await checkInitialAdminProtection(userId, data.userId);

    const patch: Record<string, unknown> = {};
    if (data.firstName !== undefined) patch["firstName"] = data.firstName;
    if (data.lastName !== undefined) patch["lastName"] = data.lastName;
    if (data.phone !== undefined) patch["phone"] = data.phone;
    if (data.idNumber !== undefined) patch["idNumber"] = data.idNumber;
    if (data.email !== undefined) patch["email"] = data.email;

    await prisma.profile.update({
      where: { id: data.userId },
      data: patch,
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "admin.user_updated",
        targetType: "profile",
        targetId: data.userId,
        details: patch,
      },
    });

    return { ok: true as const };
  });

const setScoreSchema = z.object({
  userId: z.string().uuid(),
  score: z.number().int().min(0),
});

export const adminSetCreditScore = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => setScoreSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    await checkInitialAdminProtection(userId, data.userId);

    const targetRoles = await prisma.userRole.findMany({ where: { userId: data.userId } });
    if (targetRoles.some((r) => r.role === "super_admin" || r.role === "staff")) {
      throw new Error(
        "Administrators and staff agents do not hold credibility points or loan limits.",
      );
    }

    const { calculateLoanLimitForScore } = await import("./credibility.server");
    const correspondingLimit = await calculateLoanLimitForScore(data.score);

    await prisma.profile.update({
      where: { id: data.userId },
      data: {
        credibilityScore: data.score,
        loanLimit: correspondingLimit,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "admin.score_changed",
        targetType: "profile",
        targetId: data.userId,
        details: { new_score: data.score },
      },
    });

    return { ok: true as const };
  });

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const profiles = await prisma.profile.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
      },
      orderBy: { firstName: "asc" },
    });

    return profiles.map((p) => ({
      id: p.id,
      first_name: p.firstName,
      last_name: p.lastName,
      email: p.email,
      phone: p.phone,
      status: p.status,
    }));
  });

const setStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["active", "suspended", "pending"]),
});

export const adminSetUserStatus = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => setStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    if (data.userId === userId && data.status === "suspended") {
      throw new Error("Agents and administrators cannot suspend their own account.");
    }

    await checkInitialAdminProtection(userId, data.userId);

    await prisma.profile.update({
      where: { id: data.userId },
      data: { status: data.status },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: `admin.user_${data.status}`,
        targetType: "profile",
        targetId: data.userId,
      },
    });

    return { ok: true as const };
  });

const deleteUserSchema = z.object({ userId: z.string().uuid() });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => deleteUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) throw new Error("Forbidden");
    if (data.userId === userId) throw new Error("You cannot delete your own account.");

    const initialSuperAdmin = await prisma.userRole.findFirst({
      where: { role: "super_admin" },
      orderBy: { createdAt: "asc" },
    });

    if (initialSuperAdmin && initialSuperAdmin.userId === data.userId) {
      throw new Error(
        "The initial Admin account cannot be deleted. The initial admin can transfer their role to another agent, which demotes them to a normal user account.",
      );
    }

    const targetRoles = await prisma.userRole.findMany({
      where: { userId: data.userId },
      select: { role: true },
    });
    if (targetRoles.some((r) => r.role === "super_admin")) {
      throw new Error(
        "Super Admin accounts cannot be deleted. You must transfer the Super Admin role first.",
      );
    }

    const activeLoan = await prisma.loan.findFirst({
      where: {
        userId: data.userId,
        status: {
          notIn: ["repaid", "rejected"],
        },
      },
      select: { id: true, status: true },
    });

    if (activeLoan) {
      throw new Error(
        "Cannot delete this account because the user has an active or pending loan. All loans must be settled or rejected before deletion.",
      );
    }

    const targetProfile = await prisma.profile.findUnique({
      where: { id: data.userId },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "admin.user_deleted",
        targetType: "profile",
        targetId: data.userId,
      },
    });

    await prisma.profile.delete({
      where: { id: data.userId },
    });

    if (targetProfile) {
      await notifyUserAccountDeleted({
        id: targetProfile.id,
        firstName: targetProfile.firstName,
        lastName: targetProfile.lastName,
        email: targetProfile.email,
        phone: targetProfile.phone,
        deletedBy: "admin",
      });
    }

    return { ok: true as const };
  });

const setLoanLimitSchema = z.object({
  userId: z.string().uuid(),
  limit: z.number().min(500).max(1000000),
});

export const adminSetLoanLimit = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => setLoanLimitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) throw new Error("Forbidden");

    await checkInitialAdminProtection(userId, data.userId);

    const targetRoles = await prisma.userRole.findMany({ where: { userId: data.userId } });
    if (targetRoles.some((r) => r.role === "super_admin" || r.role === "staff")) {
      throw new Error(
        "Administrators and staff agents do not hold credibility points or loan limits.",
      );
    }

    await prisma.profile.update({
      where: { id: data.userId },
      data: { loanLimit: data.limit },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "admin.loan_limit_changed",
        targetType: "profile",
        targetId: data.userId,
        details: { new_limit: data.limit },
      },
    });

    return { ok: true as const };
  });

const toggleFreezePointsSchema = z.object({
  userId: z.string().uuid(),
  isFrozen: z.boolean(),
});

export const adminToggleFreezePoints = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => toggleFreezePointsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) throw new Error("Forbidden");

    await checkInitialAdminProtection(userId, data.userId);

    await prisma.profile.update({
      where: { id: data.userId },
      data: { isEarningPointsFrozen: data.isFrozen },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: data.isFrozen ? "admin.points_earning_frozen" : "admin.points_earning_unfrozen",
        targetType: "profile",
        targetId: data.userId,
      },
    });

    return { ok: true as const };
  });

export const adminListAllTiers = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) throw new Error("Forbidden");

    const { ensureLoanProductsSeeded, getActiveEnvironment } = await import("./loans.server");
    await ensureLoanProductsSeeded();

    const environment = await getActiveEnvironment();

    const [tiers, settings] = await Promise.all([
      prisma.loanProduct.findMany({
        orderBy: { sortOrder: "asc" },
      }),
      prisma.businessSettings.findFirst({ select: { allTiersLocked: true } }),
    ]);

    const filteredTiers = environment === "sandbox" ? tiers : tiers.filter((t) => !t.isTestTier);

    return {
      environment,
      allTiersLocked: Boolean(settings?.allTiersLocked),
      tiers: filteredTiers.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        min_amount: Number(t.minAmount),
        max_amount: Number(t.maxAmount),
        interest_rate: Number(t.interestRate),
        processing_fee_rate: Number(t.processingFeeRate),
        penalty_rate:
          t.penaltyRate !== undefined && t.penaltyRate !== null ? Number(t.penaltyRate) : null,
        custom_penalty_amount:
          t.customPenaltyAmount !== null && t.customPenaltyAmount !== undefined
            ? Number(t.customPenaltyAmount)
            : null,
        term_days: t.termDays,
        min_credibility: t.minCredibility,
        guarantors_required: t.guarantorsRequired,
        sort_order: t.sortOrder,
        is_active: t.isActive,
        is_locked: t.isLocked,
        is_test_tier: Boolean(t.isTestTier),
        locked_user_ids: Array.isArray(t.lockedUserIds) ? t.lockedUserIds : [],
      })),
    };
  });

const createTierSchema = z.object({
  name: z.string().trim().min(1, "Tier name is required"),
  description: z.string().trim().default(""),
  minAmount: z.number().min(1, "Minimum amount must be at least 1"),
  maxAmount: z.number().min(1, "Maximum amount must be at least 1"),
  interestRate: z.number().min(0).max(1),
  processingFeeRate: z.number().min(0).max(1),
  penaltyRate: z.number().min(0).max(5).nullable().optional(),
  customPenaltyAmount: z.number().min(0).nullable().optional(),
  termDays: z.number().int().min(1),
  minCredibility: z.number().int().min(0),
  guarantorsRequired: z.number().int().min(0).max(10),
  isActive: z.boolean().default(true),
  isLocked: z.boolean().default(false),
  lockedUserIds: z.array(z.string().trim()).default([]),
  isTestTier: z.boolean().default(false),
});

export const adminCreateTier = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => createTierSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) throw new Error("Forbidden");

    if (roles.includes("staff") && !roles.includes("super_admin")) {
      const staffRole = await prisma.userRole.findFirst({
        where: { userId, role: "staff" },
      });
      if (
        staffRole &&
        staffRole.permissions.length > 0 &&
        !staffRole.permissions.includes("manage_tiers")
      ) {
        throw new Error("Forbidden: You do not have permission to manage loan product tiers.");
      }
    }

    const { getActiveEnvironment } = await import("./loans.server");
    const environment = await getActiveEnvironment();

    if (data.minAmount > data.maxAmount) {
      throw new Error("Minimum loan amount cannot be greater than maximum loan amount.");
    }

    if (data.isTestTier) {
      if (environment === "production") {
        throw new Error("Sandbox test tier cannot be created in production environment.");
      }
      if (data.minAmount < 1 || data.minAmount > 10 || data.maxAmount < 1 || data.maxAmount > 10) {
        throw new Error("Sandbox test tier loan amounts must be between KES 1 and KES 10.");
      }
    } else {
      if (data.minAmount < 100) {
        throw new Error("Production loan tiers must have a minimum amount of at least KES 100.");
      }
    }

    const existingName = await prisma.loanProduct.findUnique({
      where: { name: data.name },
    });
    if (existingName) {
      throw new Error(
        `A loan tier named "${data.name}" already exists. Please choose a different name.`,
      );
    }

    const maxSort = await prisma.loanProduct.aggregate({
      _max: { sortOrder: true },
    });
    const nextSortOrder = (maxSort._max.sortOrder ?? 0) + 1;

    const created = await prisma.loanProduct.create({
      data: {
        name: data.name,
        description: data.description,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount,
        interestRate: data.interestRate,
        processingFeeRate: data.processingFeeRate,
        penaltyRate: data.penaltyRate ?? null,
        customPenaltyAmount:
          data.customPenaltyAmount && data.customPenaltyAmount > 0
            ? data.customPenaltyAmount
            : null,
        termDays: data.termDays,
        minCredibility: data.minCredibility,
        guarantorsRequired: data.guarantorsRequired,
        sortOrder: nextSortOrder,
        isActive: data.isActive,
        isLocked: data.isLocked,
        isTestTier: data.isTestTier,
        lockedUserIds: data.lockedUserIds,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "admin.tier_created",
        targetType: "loan_product",
        targetId: created.id,
        details: { name: data.name, minAmount: data.minAmount, maxAmount: data.maxAmount },
      },
    });

    await sendSystemAlertToAdmins(
      "New Loan Tier Created",
      `A new loan tier "${data.name}" (KES ${data.minAmount} - ${data.maxAmount}) was created.`,
      "/admin",
    );

    return { ok: true as const, id: created.id };
  });

const addSandboxTierSchema = z.object({
  name: z.string().trim().default("Sandbox Tier"),
  description: z.string().trim().default("Small loan tier for M-Pesa sandbox testing (KES 1-10)"),
  minAmount: z.number().min(1).max(10).default(1),
  maxAmount: z.number().min(1).max(10).default(10),
  interestRate: z.number().min(0).max(1).default(0.01),
  processingFeeRate: z.number().min(0).max(1).default(0),
  penaltyRate: z.number().min(0).max(2).nullable().optional().default(0.25),
  customPenaltyAmount: z.number().min(0).nullable().optional(),
  termDays: z.number().int().min(1).default(1),
  minCredibility: z.number().int().min(0).default(0),
  guarantorsRequired: z.number().int().min(0).max(10).default(0),
});

export const adminAddSandboxTestTier = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => addSandboxTierSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) throw new Error("Forbidden");

    const { getActiveEnvironment } = await import("./loans.server");
    const environment = await getActiveEnvironment();

    if (environment !== "sandbox") {
      throw new Error("Sandbox tier can only be created when M-Pesa is in Sandbox mode.");
    }

    const existing = await prisma.loanProduct.findFirst({
      where: { isTestTier: true },
    });
    if (existing) {
      throw new Error("A sandbox tier already exists. You can edit the existing sandbox tier.");
    }

    const created = await prisma.loanProduct.create({
      data: {
        name: data.name,
        description: data.description,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount,
        interestRate: data.interestRate,
        processingFeeRate: data.processingFeeRate,
        penaltyRate: data.penaltyRate ?? 0.25,
        customPenaltyAmount: data.customPenaltyAmount || null,
        termDays: data.termDays,
        minCredibility: data.minCredibility,
        guarantorsRequired: data.guarantorsRequired,
        sortOrder: 0,
        isActive: true,
        isTestTier: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "admin.add_sandbox_test_tier",
        targetType: "loan_product",
        targetId: created.id,
        details: { name: created.name, minAmount: data.minAmount, maxAmount: data.maxAmount },
      },
    });

    return { ok: true as const, id: created.id };
  });

export const adminDeleteSandboxTestTier = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ tierId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) throw new Error("Forbidden");

    const tier = await prisma.loanProduct.findUnique({
      where: { id: data.tierId },
    });
    if (!tier || !tier.isTestTier) {
      throw new Error("Only sandbox test tiers can be removed using this action.");
    }

    await prisma.loanProduct.delete({
      where: { id: data.tierId },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "admin.delete_sandbox_test_tier",
        targetType: "loan_product",
        targetId: data.tierId,
      },
    });

    return { ok: true as const };
  });

export const adminDeleteTier = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ tierId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) throw new Error("Forbidden");

    if (roles.includes("staff") && !roles.includes("super_admin")) {
      const staffRole = await prisma.userRole.findFirst({
        where: { userId, role: "staff" },
      });
      if (
        staffRole &&
        staffRole.permissions.length > 0 &&
        !staffRole.permissions.includes("manage_tiers")
      ) {
        throw new Error("Forbidden: You do not have permission to manage loan product tiers.");
      }
    }

    const targetTier = await prisma.loanProduct.findUnique({
      where: { id: data.tierId },
    });
    if (!targetTier) throw new Error("Loan tier not found.");

    const activeLoans = await prisma.loan.findFirst({
      where: {
        productId: data.tierId,
        status: {
          in: [
            "pending_guarantors",
            "pending_approval",
            "approved",
            "disbursing",
            "active",
            "defaulted",
          ],
        },
      },
      select: { id: true, status: true },
    });

    if (activeLoans) {
      throw new Error(
        `Cannot delete tier "${targetTier.name}" because active or pending loans (${activeLoans.status}) are currently tied to it. You can set the tier to Inactive or Locked instead.`,
      );
    }

    const historicalLoans = await prisma.loan.findFirst({
      where: { productId: data.tierId },
      select: { id: true },
    });

    if (historicalLoans) {
      await prisma.loanProduct.update({
        where: { id: data.tierId },
        data: { isActive: false, isLocked: true },
      });
    } else {
      await prisma.loanProduct.delete({
        where: { id: data.tierId },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "admin.tier_deleted",
        targetType: "loan_product",
        targetId: data.tierId,
        details: { name: targetTier.name },
      },
    });

    await sendSystemAlertToAdmins(
      "Loan Tier Deleted",
      `Loan product tier "${targetTier.name}" was deleted.`,
      "/admin",
    );

    return { ok: true as const };
  });

const updateTierSchema = z.object({
  tierId: z.string().uuid(),
  name: z.string().trim().min(1),
  description: z.string().trim().default(""),
  minAmount: z.number().min(1),
  maxAmount: z.number().min(1),
  interestRate: z.number().min(0).max(1),
  processingFeeRate: z.number().min(0).max(1),
  penaltyRate: z.number().min(0).max(5).nullable().optional(),
  customPenaltyAmount: z.number().min(0).nullable().optional(),
  termDays: z.number().int().min(1),
  minCredibility: z.number().int().min(0),
  guarantorsRequired: z.number().int().min(0).max(10),
  isActive: z.boolean(),
  isLocked: z.boolean(),
  lockedUserIds: z.array(z.string().trim()).default([]),
});

export const adminUpdateTier = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => updateTierSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) throw new Error("Forbidden");

    if (roles.includes("staff") && !roles.includes("super_admin")) {
      const staffRole = await prisma.userRole.findFirst({
        where: { userId, role: "staff" },
      });
      if (
        staffRole &&
        staffRole.permissions.length > 0 &&
        !staffRole.permissions.includes("manage_tiers")
      ) {
        throw new Error("Forbidden: You do not have permission to manage loan product tiers.");
      }
    }

    const { getActiveEnvironment } = await import("./loans.server");
    const environment = await getActiveEnvironment();

    const targetTier = await prisma.loanProduct.findUnique({
      where: { id: data.tierId },
    });
    if (!targetTier) throw new Error("Loan tier not found.");

    if (targetTier.isTestTier) {
      if (environment === "production") {
        throw new Error("Sandbox test tier cannot be edited or used in production environment.");
      }
      if (data.minAmount < 1 || data.minAmount > 10 || data.maxAmount < 1 || data.maxAmount > 10) {
        throw new Error("Sandbox test tier loan amounts must be between KES 1 and KES 10.");
      }
    } else {
      if (data.minAmount < 100) {
        throw new Error("Production loan tiers must have a minimum amount of at least KES 100.");
      }
    }

    if (data.minAmount > data.maxAmount) {
      throw new Error("Minimum loan amount cannot be greater than maximum loan amount.");
    }

    await prisma.loanProduct.update({
      where: { id: data.tierId },
      data: {
        name: data.name,
        description: data.description,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount,
        interestRate: data.interestRate,
        processingFeeRate: data.processingFeeRate,
        penaltyRate: data.penaltyRate !== undefined ? data.penaltyRate : null,
        customPenaltyAmount:
          data.customPenaltyAmount && data.customPenaltyAmount > 0
            ? data.customPenaltyAmount
            : null,
        termDays: data.termDays,
        minCredibility: data.minCredibility,
        guarantorsRequired: data.guarantorsRequired,
        isActive: data.isActive,
        isLocked: data.isLocked,
        lockedUserIds: data.lockedUserIds,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "admin.tier_updated",
        targetType: "loan_product",
        targetId: data.tierId,
        details: { name: data.name, isLocked: data.isLocked },
      },
    });

    await sendSystemAlertToAdmins(
      "Loan Tier Saved",
      `Settings for loan tier "${data.name}" were updated.`,
      "/admin",
    );

    return { ok: true as const };
  });

export const adminToggleLockAllTiers = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ allTiersLocked: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) throw new Error("Forbidden");

    const settings = await prisma.businessSettings.findFirst();
    if (settings) {
      await prisma.businessSettings.update({
        where: { id: settings.id },
        data: { allTiersLocked: data.allTiersLocked },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: data.allTiersLocked ? "admin.lock_all_tiers" : "admin.unlock_all_tiers",
        targetType: "business_settings",
      },
    });

    return { ok: true as const };
  });

export const adminListTestimonials = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) throw new Error("Forbidden");

    const list = await prisma.testimonial.findMany({
      orderBy: { createdAt: "desc" },
    });

    return list.map((t) => ({
      id: t.id,
      user_id: t.userId,
      author_name: t.authorName,
      role: t.role,
      content: t.content,
      rating: t.rating,
      status: t.status,
      created_at: t.createdAt.toISOString(),
    }));
  });

const decideTestimonialSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
});

export const adminDecideTestimonial = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => decideTestimonialSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) throw new Error("Forbidden");

    const item = await prisma.testimonial.update({
      where: { id: data.id },
      data: { status: data.status },
      select: { id: true, userId: true },
    });

    if (data.status === "approved" && item?.userId) {
      const { syncUserCredibilityScore } = await import("./credibility.server");
      await syncUserCredibilityScore(item.userId);
    }

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: `admin.testimonial_${data.status}`,
        targetType: "testimonial",
        targetId: data.id,
      },
    });

    await sendSystemAlertToAdmins(
      `Testimonial ${data.status === "approved" ? "Approved" : "Rejected"}`,
      `A borrower testimonial submission was ${data.status}.`,
      "/admin",
    );

    return { ok: true as const };
  });

export const adminDeleteTestimonial = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) throw new Error("Forbidden");

    await prisma.testimonial.delete({ where: { id: data.id } });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "admin.testimonial_deleted",
        targetType: "testimonial",
        targetId: data.id,
      },
    });

    await sendSystemAlertToAdmins(
      "Testimonial Deleted",
      "A borrower testimonial was removed from the system.",
      "/admin",
    );

    return { ok: true as const };
  });

export const adminListAgents = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin")) throw new Error("Forbidden");

    const [agentRoles, initialSuperAdmin, superAdminRoles] = await Promise.all([
      prisma.userRole.findMany({
        where: { role: "staff" },
        include: {
          profile: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.userRole.findFirst({
        where: { role: "super_admin" },
        orderBy: { createdAt: "asc" },
      }),
      prisma.userRole.findMany({
        where: { role: "super_admin" },
        select: { userId: true },
      }),
    ]);

    const superAdminUserIds = new Set(superAdminRoles.map((r) => r.userId));

    return agentRoles.map((ar) => ({
      id: ar.profile.id,
      first_name: ar.profile.firstName,
      last_name: ar.profile.lastName,
      email: ar.profile.email,
      phone: ar.profile.phone,
      status: ar.profile.status,
      permissions: ar.permissions,
      created_at: ar.profile.createdAt.toISOString(),
      is_super_admin: superAdminUserIds.has(ar.profile.id),
      is_initial_admin: Boolean(initialSuperAdmin && initialSuperAdmin.userId === ar.profile.id),
    }));
  });

const createAgentSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().email().toLowerCase(),
  phone: z.string().trim().min(9),
  password: z.string().min(6),
  permissions: z.array(z.string()).default([]),
});

export const adminCreateAgent = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => createAgentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin")) throw new Error("Forbidden");

    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(data.password, 10);

    const existing = await prisma.profile.findFirst({
      where: { OR: [{ email: data.email }, { phone: data.phone }] },
    });
    if (existing) throw new Error("An account with that email or phone number already exists.");

    const { generateReferralCode } = await import("./account.server");

    const agent = await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          passwordHash,
          referralCode: generateReferralCode(),
          emailVerified: true,
          phoneVerified: true,
          credibilityScore: 0,
          loanLimit: 0,
        },
      });

      await tx.userRole.create({
        data: {
          userId: profile.id,
          role: "staff",
          permissions: data.permissions,
        },
      });

      return profile;
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "admin.agent_created",
        targetType: "profile",
        targetId: agent.id,
        details: { email: data.email, permissions: data.permissions },
      },
    });

    return { ok: true as const, id: agent.id };
  });

const updateAgentPermissionsSchema = z.object({
  agentUserId: z.string().uuid(),
  permissions: z.array(z.string()),
});

export const adminUpdateAgentPermissions = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => updateAgentPermissionsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin")) throw new Error("Forbidden");

    await prisma.userRole.updateMany({
      where: { userId: data.agentUserId, role: "staff" },
      data: { permissions: data.permissions },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "admin.agent_permissions_updated",
        targetType: "profile",
        targetId: data.agentUserId,
        details: { permissions: data.permissions },
      },
    });

    await sendSystemAlertToAdmins(
      "Agent Permissions Updated",
      `Operational task permissions were updated for staff agent ID ${data.agentUserId.slice(0, 8)}.`,
      "/admin",
    );

    return { ok: true as const };
  });

const promoteUserToAgentSchema = z.object({
  userId: z.string().uuid(),
  permissions: z.array(z.string()).default([]),
});

export const adminPromoteUserToAgent = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => promoteUserToAgentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId: actorId, roles } = context;
    if (!roles.includes("super_admin")) throw new Error("Forbidden");

    const targetProfile = await prisma.profile.findUnique({
      where: { id: data.userId },
      include: { roles: true },
    });

    if (!targetProfile) {
      throw new Error("Target user profile was not found.");
    }

    if (targetProfile.status !== "active") {
      throw new Error(
        `Cannot add user as staff agent because their account status is "${targetProfile.status}". Only active users can be appointed as staff agents.`,
      );
    }

    const userLoans = await prisma.loan.findMany({
      where: { userId: data.userId },
      select: { status: true },
    });

    const hasDefaulted = userLoans.some((l) => l.status === "defaulted");
    if (hasDefaulted) {
      throw new Error("Cannot appoint user as staff agent because they have defaulted on a loan.");
    }

    const activeLoanStatuses = [
      "pending_guarantors",
      "pending_approval",
      "approved",
      "disbursing",
      "active",
    ];
    const hasActiveLoan = userLoans.some((l) => activeLoanStatuses.includes(l.status));
    if (hasActiveLoan) {
      throw new Error(
        "Cannot appoint user as staff agent because they currently have an active, pending, or disbursing loan.",
      );
    }

    // Zero out credibility score and loan limit for staff agent
    await prisma.profile.update({
      where: { id: targetProfile.id },
      data: { credibilityScore: 0, loanLimit: 0 },
    });

    const existingStaffRole = targetProfile.roles.find((r) => r.role === "staff");

    if (existingStaffRole) {
      await prisma.userRole.update({
        where: { id: existingStaffRole.id },
        data: { permissions: data.permissions },
      });
    } else {
      await prisma.userRole.create({
        data: {
          userId: targetProfile.id,
          role: "staff",
          permissions: data.permissions,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId,
        action: "admin.agent_promoted_from_user",
        targetType: "profile",
        targetId: targetProfile.id,
        details: { permissions: data.permissions },
      },
    });

    await sendSystemAlertToAdmins(
      "Staff Agent Appointed",
      `${targetProfile.firstName} ${targetProfile.lastName} (${targetProfile.email}) was appointed as a task-based staff agent.`,
      "/admin",
    );

    return { ok: true as const, id: targetProfile.id };
  });

export const adminRemoveAgentRole = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId: actorId, roles } = context;
    if (!roles.includes("super_admin")) throw new Error("Forbidden");

    const initialSuperAdmin = await prisma.userRole.findFirst({
      where: { role: "super_admin" },
      orderBy: { createdAt: "asc" },
    });

    if (initialSuperAdmin && initialSuperAdmin.userId === data.userId) {
      throw new Error(
        "The initial Super Admin account cannot be removed or demoted. You must transfer the Super Admin role to another staff agent first.",
      );
    }

    const targetSuperAdmin = await prisma.userRole.findFirst({
      where: { userId: data.userId, role: "super_admin" },
    });
    if (targetSuperAdmin) {
      throw new Error(
        "Super Admin accounts cannot be demoted directly. Transfer the Super Admin role first.",
      );
    }

    await prisma.userRole.deleteMany({
      where: { userId: data.userId, role: "staff" },
    });

    const remainingAdminRoles = await prisma.userRole.findMany({
      where: { userId: data.userId, role: { in: ["super_admin", "staff"] } },
    });
    if (remainingAdminRoles.length === 0) {
      await prisma.profile.update({
        where: { id: data.userId },
        data: { credibilityScore: 300, loanLimit: 1000 },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId,
        action: "admin.agent_role_removed",
        targetType: "profile",
        targetId: data.userId,
      },
    });

    await sendSystemAlertToAdmins(
      "Staff Agent Role Revoked",
      `Staff agent privileges were revoked for user ID ${data.userId.slice(0, 8)}.`,
      "/admin",
    );

    return { ok: true as const };
  });

const transferSuperAdminSchema = z.object({
  targetUserId: z.string().uuid(),
});

export const adminTransferSuperAdminRole = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => transferSuperAdminSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId: actorId, roles } = context;
    if (!roles.includes("super_admin")) throw new Error("Forbidden");

    if (actorId === data.targetUserId) {
      throw new Error("You are already a Super Admin.");
    }

    const targetProfile = await prisma.profile.findUnique({
      where: { id: data.targetUserId },
      include: { roles: true },
    });

    if (!targetProfile) {
      throw new Error("Target user profile was not found.");
    }

    if (targetProfile.status !== "active") {
      throw new Error("Super Admin role can only be transferred to an active account.");
    }

    const fullPermissions = [
      "approve_loans",
      "manage_users",
      "manage_tiers",
      "manage_testimonials",
      "manage_phone_requests",
      "manage_settings",
      "receive_system_alerts",
    ];

    const { calculateLoanLimitForScore } = await import("./credibility.server");
    const baseScore = 300;
    const baseLimit = await calculateLoanLimitForScore(baseScore);

    await prisma.$transaction(async (tx) => {
      const hasSuperAdmin = targetProfile.roles.some((r) => r.role === "super_admin");
      if (!hasSuperAdmin) {
        await tx.userRole.create({
          data: {
            userId: targetProfile.id,
            role: "super_admin",
            permissions: fullPermissions,
          },
        });
      }

      const existingStaff = targetProfile.roles.find((r) => r.role === "staff");
      if (!existingStaff) {
        await tx.userRole.create({
          data: {
            userId: targetProfile.id,
            role: "staff",
            permissions: fullPermissions,
          },
        });
      } else {
        await tx.userRole.update({
          where: { id: existingStaff.id },
          data: { permissions: fullPermissions },
        });
      }

      // New Super Admin has 0 score & 0 limit
      await tx.profile.update({
        where: { id: targetProfile.id },
        data: {
          credibilityScore: 0,
          loanLimit: 0,
        },
      });

      // Demote current initial admin / caller to a normal user account
      await tx.userRole.deleteMany({
        where: {
          userId: actorId,
          role: { in: ["super_admin", "staff"] },
        },
      });

      // Ensure caller has user role
      const actorRoles = await tx.userRole.findMany({
        where: { userId: actorId },
      });
      if (!actorRoles.some((r) => r.role === "user")) {
        await tx.userRole.create({
          data: {
            userId: actorId,
            role: "user",
          },
        });
      }

      // Reset former admin account to base credibility score (300) and corresponding loan limit
      await tx.profile.update({
        where: { id: actorId },
        data: {
          credibilityScore: baseScore,
          loanLimit: baseLimit,
          isEarningPointsFrozen: false,
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        actorId,
        action: "admin.super_admin_role_transferred",
        targetType: "profile",
        targetId: targetProfile.id,
      },
    });

    await sendSystemAlertToAdmins(
      "Super Admin Role Transferred",
      `Super Admin operational authority was transferred to ${targetProfile.firstName} ${targetProfile.lastName}.`,
      "/admin",
    );

    return { ok: true as const };
  });

const updateBusinessSettingsSchema = z.object({
  businessName: z.string().trim().min(1),
  businessLocation: z.string().trim().min(1),
  supportPhone: z.string().trim().optional(),
  supportEmail: z.string().trim().optional(),
  mpesaShortcode: z.string().trim().optional(),
  mpesaCallbackUrl: z.string().trim().optional(),
  logoUrl: z.string().trim().optional(),
  faviconUrl: z.string().trim().optional(),
  primaryColor: z.string().trim().optional(),
  secondaryColor: z.string().trim().optional(),
  accentColor: z.string().trim().optional(),
  backgroundColor: z.string().trim().optional(),
  foregroundColor: z.string().trim().optional(),
  goldColor: z.string().trim().optional(),
  landingContent: z.string().trim().optional(),
  termsContent: z.string().trim().optional(),
  privacyContent: z.string().trim().optional(),
  minCredibilityScore: z.number().int().min(0).optional(),
  maxCredibilityScore: z.number().int().min(1).optional(),
});

export const adminUpdateBusinessSettings = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => updateBusinessSettingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) throw new Error("Forbidden");

    const settings = await prisma.businessSettings.findFirst();
    if (settings) {
      await prisma.businessSettings.update({
        where: { id: settings.id },
        data: {
          businessName: data.businessName,
          businessLocation: data.businessLocation,
          supportPhone: data.supportPhone,
          supportEmail: data.supportEmail,
          mpesaShortcode: data.mpesaShortcode,
          mpesaCallbackUrl: data.mpesaCallbackUrl,
          logoUrl: data.logoUrl || null,
          faviconUrl: data.faviconUrl || null,
          primaryColor: data.primaryColor || null,
          secondaryColor: data.secondaryColor || null,
          accentColor: data.accentColor || null,
          backgroundColor: data.backgroundColor || null,
          foregroundColor: data.foregroundColor || null,
          goldColor: data.goldColor || null,
          landingContent: data.landingContent || null,
          termsContent: data.termsContent || null,
          privacyContent: data.privacyContent || null,
          ...(data.minCredibilityScore !== undefined
            ? { minCredibilityScore: data.minCredibilityScore }
            : {}),
          ...(data.maxCredibilityScore !== undefined
            ? { maxCredibilityScore: data.maxCredibilityScore }
            : {}),
        },
      });
    } else {
      await prisma.businessSettings.create({
        data: {
          businessName: data.businessName,
          businessLocation: data.businessLocation,
          supportPhone: data.supportPhone,
          supportEmail: data.supportEmail,
          mpesaShortcode: data.mpesaShortcode,
          mpesaCallbackUrl: data.mpesaCallbackUrl,
          logoUrl: data.logoUrl || null,
          faviconUrl: data.faviconUrl || null,
          primaryColor: data.primaryColor || null,
          secondaryColor: data.secondaryColor || null,
          accentColor: data.accentColor || null,
          backgroundColor: data.backgroundColor || null,
          foregroundColor: data.foregroundColor || null,
          goldColor: data.goldColor || null,
          landingContent: data.landingContent || null,
          termsContent: data.termsContent || null,
          privacyContent: data.privacyContent || null,
          minCredibilityScore: data.minCredibilityScore ?? 0,
          maxCredibilityScore: data.maxCredibilityScore ?? 1000,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "admin.business_settings_updated",
        targetType: "business_settings",
        details: data,
      },
    });

    return { ok: true as const };
  });

export const adminSaveLandingContent = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ landingContent: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const settings = await prisma.businessSettings.findFirst();
    if (settings) {
      await prisma.businessSettings.update({
        where: { id: settings.id },
        data: {
          landingContent: data.landingContent,
        },
      });
    } else {
      await prisma.businessSettings.create({
        data: {
          businessName: process.env["BUSINESS_NAME"] || "Lending Platform",
          businessLocation: "Nairobi, Kenya",
          landingContent: data.landingContent,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "admin.landing_content_updated",
        targetType: "business_settings",
      },
    });

    return { ok: true as const };
  });

export const getAdminUserDetails = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ targetUserId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const [
      user,
      rolesList,
      initialAdminSetting,
      initialSuperAdmin,
      userGuarantors,
      userLoans,
      phoneRequests,
      auditLogs,
    ] = await Promise.all([
      prisma.profile.findUnique({
        where: { id: data.targetUserId },
      }),
      prisma.userRole.findMany({
        where: { userId: data.targetUserId },
      }),
      prisma.businessSettings.findFirst(),
      prisma.userRole.findFirst({
        where: { role: "super_admin" },
        orderBy: { createdAt: "asc" },
      }),
      prisma.userGuarantor.findMany({
        where: { userId: data.targetUserId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.loan.findMany({
        where: { userId: data.targetUserId },
        include: {
          product: true,
          guarantors: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.phoneChangeRequest.findMany({
        where: { userId: data.targetUserId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.findMany({
        where: { targetId: data.targetUserId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    if (!user) throw new Error("User not found");

    const userRoles = rolesList.map((r) => r.role);
    const isSuperAdmin = userRoles.includes("super_admin");
    const isAgent = userRoles.includes("staff");
    const isInitialAdmin = Boolean(initialSuperAdmin && initialSuperAdmin.userId === user.id);
    const isAdminOrAgent = isSuperAdmin || isAgent || isInitialAdmin;

    const smtpHost = initialAdminSetting?.smtpHost || process.env["SMTP_HOST"];
    const smtpUser = initialAdminSetting?.smtpUser || process.env["SMTP_USER"];
    const smtpPass = initialAdminSetting?.smtpPass || process.env["SMTP_PASS"];
    const smtpFromEmail =
      initialAdminSetting?.smtpFromEmail ||
      process.env["SMTP_FROM_EMAIL"] ||
      initialAdminSetting?.supportEmail ||
      smtpUser;
    const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPass && smtpFromEmail);

    return {
      smtp_configured: smtpConfigured,
      business_name:
        initialAdminSetting?.businessName || process.env["BUSINESS_NAME"] || "Lending Platform",
      user: {
        id: user.id,
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        phone: user.phone,
        id_number: user.idNumber,
        status: user.status,
        credibility_score: isAdminOrAgent ? 0 : user.credibilityScore,
        loan_limit: isAdminOrAgent ? 0 : Number(user.loanLimit),
        is_earning_points_frozen: user.isEarningPointsFrozen,
        referral_code: user.referralCode,
        referred_by: user.referredBy,
        created_at: user.createdAt.toISOString(),
        is_agent: isAgent,
        is_super_admin: isSuperAdmin,
        is_initial_admin: isInitialAdmin,
        roles: userRoles,
      },
      guarantors: userGuarantors.map((g) => ({
        id: g.id,
        first_name: g.firstName,
        last_name: g.lastName,
        phone: g.phone,
        id_number: g.idNumber,
        address: g.address,
        relationship: g.relationship,
        occupation: g.occupation,
        created_at: g.createdAt.toISOString(),
      })),
      loans: userLoans.map((l) => ({
        id: l.id,
        principal: Number(l.principal),
        interest_amount: Number(l.interestAmount),
        processing_fee: Number(l.processingFee),
        total_due: Number(l.totalDue),
        amount_repaid: Number(l.amountRepaid),
        status: l.status,
        purpose: l.purpose,
        disbursement_phone: l.disbursementPhone,
        guarantors_required: l.guarantorsRequired,
        created_at: l.createdAt.toISOString(),
        product_name: l.product?.name ?? "—",
        guarantors_count: l.guarantors.length,
        accepted_guarantors_count: l.guarantors.filter((g) => g.status === "accepted").length,
      })),
      phone_requests: phoneRequests.map((pr) => ({
        id: pr.id,
        current_phone: pr.currentPhone,
        requested_phone: pr.requestedPhone,
        reason: pr.reason,
        status: pr.status,
        created_at: pr.createdAt.toISOString(),
      })),
      audit_logs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        created_at: log.createdAt.toISOString(),
      })),
    };
  });

const saveUserGuarantorSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid(),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  phone: z.string().trim().min(1, "Phone number is required"),
  idNumber: z.string().trim().min(1, "ID number is required"),
  address: z.string().trim().optional(),
  relationship: z.string().trim().optional(),
  occupation: z.string().trim().optional(),
});

export const adminSaveUserGuarantor = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => saveUserGuarantorSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    if (data.id) {
      await prisma.userGuarantor.update({
        where: { id: data.id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          idNumber: data.idNumber,
          address: data.address || "",
          relationship: data.relationship || "",
          occupation: data.occupation || "",
        },
      });
    } else {
      await prisma.userGuarantor.create({
        data: {
          userId: data.userId,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          idNumber: data.idNumber,
          address: data.address || "",
          relationship: data.relationship || "",
          occupation: data.occupation || "",
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: data.id ? "admin.user_guarantor_updated" : "admin.user_guarantor_created",
        targetType: "user_guarantor",
        targetId: data.userId,
        details: { guarantorPhone: data.phone },
      },
    });

    return { ok: true as const };
  });

export const adminDeleteUserGuarantor = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    await prisma.userGuarantor.delete({
      where: { id: data.id },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "admin.user_guarantor_deleted",
        targetType: "user_guarantor",
        targetId: data.id,
      },
    });

    return { ok: true as const };
  });

const rulesSchema = z.object({
  allowActivationWithoutDisbursement: z.boolean().default(false),
  enable2faByEmail: z.boolean().default(false),
  lockDarajaConfig: z.boolean().default(false),
  lockSmtpConfig: z.boolean().default(false),
  lockLandingEditMode: z.boolean().default(false),
  maxActiveLoansPerBorrower: z.number().int().min(1).max(10).default(1),
  requireGuarantorsForLoans: z.boolean().default(true),
  autoRejectIfDefaulted: z.boolean().default(true),
});

export const getAdminRules = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const settings = await prisma.businessSettings.findFirst();
    const smtpConfigured = Boolean(
      settings?.smtpHost && settings?.smtpUser && settings?.smtpFromEmail,
    );
    const darajaConfigured = Boolean(settings?.mpesaShortcode || settings?.mpesaCallbackUrl);

    return {
      allowActivationWithoutDisbursement: Boolean(settings?.allowActivationWithoutDisbursement),
      enable2faByEmail: Boolean(settings?.enable2faByEmail),
      lockDarajaConfig: Boolean(settings?.lockDarajaConfig),
      lockSmtpConfig: Boolean(settings?.lockSmtpConfig),
      lockLandingEditMode: Boolean(settings?.lockLandingEditMode),
      maxActiveLoansPerBorrower: settings?.maxActiveLoansPerBorrower ?? 1,
      requireGuarantorsForLoans: settings?.requireGuarantorsForLoans ?? true,
      autoRejectIfDefaulted: settings?.autoRejectIfDefaulted ?? true,
      smtpConfigured,
      darajaConfigured,
      updatedAt: settings?.updatedAt ? new Date(settings.updatedAt).toISOString() : null,
    };
  });

export const saveAdminRules = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => rulesSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const settings = await prisma.businessSettings.findFirst();
    if (!settings) throw new Error("Business settings not initialized.");

    await prisma.businessSettings.update({
      where: { id: settings.id },
      data: {
        allowActivationWithoutDisbursement: data.allowActivationWithoutDisbursement,
        enable2faByEmail: data.enable2faByEmail,
        lockDarajaConfig: data.lockDarajaConfig,
        lockSmtpConfig: data.lockSmtpConfig,
        lockLandingEditMode: data.lockLandingEditMode,
        maxActiveLoansPerBorrower: data.maxActiveLoansPerBorrower,
        requireGuarantorsForLoans: data.requireGuarantorsForLoans,
        autoRejectIfDefaulted: data.autoRejectIfDefaulted,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "system.rules_updated",
        targetType: "business_settings",
        targetId: settings.id,
        details: data,
      },
    });

    return { ok: true as const, message: "App rules and operational policies saved successfully." };
  });

async function wipeEntireDatabase() {
  return await prisma.$transaction(async (tx) => {
    await tx.supportResponse.deleteMany({});
    await tx.supportTicket.deleteMany({});
    await tx.phoneChangeRequest.deleteMany({});
    await tx.loanRepayment.deleteMany({});
    await tx.mpesaTransaction.deleteMany({});
    await tx.loanGuarantor.deleteMany({});
    await tx.loanStatusEvent.deleteMany({});
    await tx.loan.deleteMany({});
    await tx.userGuarantor.deleteMany({});
    await tx.referralReward.deleteMany({});
    await tx.notification.deleteMany({});
    await tx.pushSubscription.deleteMany({});
    await tx.userSession.deleteMany({});
    await tx.testimonial.deleteMany({});
    await tx.newsletterSubscriber.deleteMany({});
    await tx.auditLog.deleteMany({});
    await tx.heroImagePreset.deleteMany({});
    await tx.darajaCredentials.deleteMany({});
    await tx.loanProduct.deleteMany({});
    await tx.userRole.deleteMany({});
    await tx.profile.deleteMany({});
    await tx.businessSettings.deleteMany({});
  });
}

export const deleteBusinessFn = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator(
    z.object({
      confirmPhrase: z.string(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;

    const initialSuperAdmin = await prisma.userRole.findFirst({
      where: { role: "super_admin" },
      orderBy: { createdAt: "asc" },
    });
    const isInitialAdmin = Boolean(initialSuperAdmin && initialSuperAdmin.userId === userId);
    const isSuperAdmin = roles.includes("super_admin") || isInitialAdmin;

    if (!isSuperAdmin) {
      throw new Error(
        "Forbidden: Only a Super Admin or Initial Administrator can delete the business.",
      );
    }

    const settings = await prisma.businessSettings.findFirst();
    const currentName = settings?.businessName?.trim() || "";

    const userPhrase = data.confirmPhrase.trim().toLowerCase();
    const isValid =
      userPhrase === "delete" ||
      (currentName.length > 0 && userPhrase === currentName.toLowerCase()) ||
      (currentName.length > 0 && userPhrase === `delete ${currentName.toLowerCase()}`);

    if (!isValid) {
      throw new Error(
        `Confirmation mismatch. Please type '${currentName}' or 'DELETE' to confirm deletion.`,
      );
    }

    await wipeEntireDatabase();

    return {
      ok: true as const,
      message: "Business and all database records have been permanently deleted. Platform reset.",
    };
  });
