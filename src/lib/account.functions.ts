import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  loginSchema,
  registerSchema,
  setupSchema,
  updateProfileSchema,
  changePasswordSchema,
  phoneChangeRequestSchema,
} from "./schemas";
import { requireCustomAuth } from "./auth-middleware";
import { prisma } from "./prisma";

export const getSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { adminExists, setupCompleted } = await import("./account.server");
    const [hasAdmin, completed] = await Promise.all([adminExists(), setupCompleted()]);
    return { needsSetup: !hasAdmin || !completed, locked: hasAdmin && completed };
  } catch (err) {
    console.error("[getSetupStatus error]:", err);
    return { needsSetup: true, locked: false };
  }
});

export const completeSetup = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const res = setupSchema.safeParse(data);
    if (!res.success) {
      throw new Error(res.error.issues[0]?.message || "Invalid setup details");
    }
    return res.data;
  })
  .handler(async ({ data }) => {
    try {
      const { adminExists, setupCompleted, createFirstAdmin } = await import("./account.server");
      const [hasAdmin, completed] = await Promise.all([adminExists(), setupCompleted()]);
      if (hasAdmin && completed) {
        return { ok: false as const, error: "Setup has already been completed for this business." };
      }
      await createFirstAdmin(data);
      return { ok: true as const };
    } catch (err) {
      console.error("[completeSetup error]:", err);
      const msg = err instanceof Error ? err.message : "Setup failed. Please try again.";
      return { ok: false as const, error: msg };
    }
  });

export const registerMember = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const res = registerSchema.safeParse(data);
    if (!res.success) {
      throw new Error(res.error.issues[0]?.message || "Invalid registration details");
    }
    return res.data;
  })
  .handler(async ({ data }) => {
    try {
      const { createMember } = await import("./account.server");
      const result = await createMember(data);
      if (result.conflict) {
        const messages = {
          email: "An account with that email already exists.",
          phone: "That phone number is already registered.",
          id_number: "That ID number is already registered.",
        } as const;
        return { ok: false as const, error: messages[result.conflict] };
      }
      if (result.requiresVerification) {
        return {
          ok: true as const,
          requiresVerification: true as const,
          tempToken: result.tempToken,
          maskedEmail: result.maskedEmail,
        };
      }
      return { ok: true as const, requiresVerification: false as const };
    } catch (err) {
      console.error("[registerMember error]:", err);
      const msg = err instanceof Error ? err.message : "Registration failed. Please try again.";
      return {
        ok: false as const,
        error: msg,
      };
    }
  });

export const verifyRegistrationEmailFn = createServerFn({ method: "POST" })
  .validator((data: { tempToken: string; code: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { verifyRegistrationEmail } = await import("./account.server");
      const result = await verifyRegistrationEmail(data.tempToken, data.code);
      return result;
    } catch (err) {
      console.error("[verifyRegistrationEmailFn error]:", err);
      const msg =
        err instanceof Error ? err.message : "Email verification failed. Please try again.";
      return { ok: false as const, error: msg };
    }
  });

export const resendRegistrationCodeFn = createServerFn({ method: "POST" })
  .validator((data: { tempToken: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { resendRegistrationCode } = await import("./account.server");
      const result = await resendRegistrationCode(data.tempToken);
      return result;
    } catch (err) {
      console.error("[resendRegistrationCodeFn error]:", err);
      const msg = err instanceof Error ? err.message : "Failed to resend verification code.";
      return { ok: false as const, error: msg };
    }
  });

export const signInWithIdentifier = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const res = loginSchema.safeParse(data);
    if (!res.success) {
      throw new Error(res.error.issues[0]?.message || "Invalid credentials format");
    }
    return res.data;
  })
  .handler(async ({ data }) => {
    try {
      const { loginUser } = await import("./account.server");
      const result = await loginUser(data.identifier, data.password);
      if (!result.ok) {
        if ("requiresEmailVerification" in result && result.requiresEmailVerification) {
          return {
            ok: false as const,
            requiresEmailVerification: true as const,
            tempToken: result.tempToken,
            maskedEmail: result.maskedEmail,
            error: result.error,
          };
        }
        return { ok: false as const, error: result.error };
      }
      if (result.requires2fa) {
        return {
          ok: true as const,
          requires2fa: true as const,
          tempToken: result.tempToken,
          maskedEmail: result.maskedEmail,
          message: result.message,
        };
      }
      return {
        ok: true as const,
        requires2fa: false as const,
        token: result.token,
        user: result.user,
      };
    } catch (err) {
      console.error("[signInWithIdentifier error]:", err);
      const msg = err instanceof Error ? err.message : "Sign in failed. Please try again.";
      return { ok: false as const, error: msg };
    }
  });

export const verify2faLoginFn = createServerFn({ method: "POST" })
  .validator((data: { tempToken: string; code: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { verify2faLogin } = await import("./account.server");
      const result = await verify2faLogin(data.tempToken, data.code);
      return result;
    } catch (err) {
      console.error("[verify2faLoginFn error]:", err);
      const msg = err instanceof Error ? err.message : "2FA verification failed. Please try again.";
      return { ok: false as const, error: msg };
    }
  });

export const resend2faLoginCodeFn = createServerFn({ method: "POST" })
  .validator((data: { tempToken: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { resend2faLoginCode } = await import("./account.server");
      const result = await resend2faLoginCode(data.tempToken);
      return result;
    } catch (err) {
      console.error("[resend2faLoginCodeFn error]:", err);
      const msg = err instanceof Error ? err.message : "Failed to resend verification code.";
      return { ok: false as const, error: msg };
    }
  });

export const getAuthProfile = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    try {
      const { userId } = context;

      const [profile, roles, initialAdminRole] = await Promise.all([
        prisma.profile.findUnique({
          where: { id: userId },
        }),
        prisma.userRole.findMany({
          where: { userId },
          select: { role: true, permissions: true },
        }),
        prisma.userRole.findFirst({
          where: { role: "super_admin" },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      if (!profile) return null;

      const roleList = roles.map((r) => r.role as string);
      const staffRole = roles.find((r) => r.role === "staff");
      const permissions = staffRole ? staffRole.permissions : [];

      const isInitialAdmin = Boolean(initialAdminRole && initialAdminRole.userId === userId);
      const isAdminOrStaff =
        roleList.includes("super_admin") || roleList.includes("staff") || isInitialAdmin;

      return {
        profile: {
          id: profile.id,
          first_name: profile.firstName,
          last_name: profile.lastName,
          email: profile.email,
          phone: profile.phone,
          id_number: profile.idNumber,
          referral_code: profile.referralCode,
          referred_by: profile.referredBy,
          credibility_score: isAdminOrStaff ? 0 : profile.credibilityScore,
          is_earning_points_frozen: profile.isEarningPointsFrozen,
          loan_limit: isAdminOrStaff ? 0 : Number(profile.loanLimit),
          status: profile.status,
          email_verified: profile.emailVerified,
          phone_verified: profile.phoneVerified,
          created_at: new Date(profile.createdAt).toISOString(),
          updated_at: new Date(profile.updatedAt).toISOString(),
        },
        roles: roleList,
        permissions,
        isInitialAdmin,
      };
    } catch (err) {
      console.error("[getAuthProfile error]:", err);
      return null;
    }
  });

export const updateAuthProfile = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((data: unknown) => {
    const res = updateProfileSchema.safeParse(data);
    if (!res.success) {
      throw new Error(res.error.issues[0]?.message || "Invalid profile details");
    }
    return res.data;
  })
  .handler(async ({ context, data }) => {
    try {
      const { userId } = context;
      const { updateUserProfile } = await import("./account.server");
      return await updateUserProfile(userId, data);
    } catch (err) {
      console.error("[updateAuthProfile error]:", err);
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      return { ok: false as const, error: msg };
    }
  });

export const changePassword = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((data: unknown) => {
    const res = changePasswordSchema.safeParse(data);
    if (!res.success) {
      throw new Error(res.error.issues[0]?.message || "Invalid password details");
    }
    return res.data;
  })
  .handler(async ({ context, data }) => {
    try {
      const { userId } = context;
      const { changeUserPassword } = await import("./account.server");
      return await changeUserPassword(userId, data);
    } catch (err) {
      console.error("[changePassword error]:", err);
      const msg = err instanceof Error ? err.message : "Failed to change password";
      return { ok: false as const, error: msg };
    }
  });

export const getUserSessions = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    try {
      const { userId } = context;
      const request = getRequest();
      const userAgent = request?.headers?.get("user-agent") || "Web Browser";
      const ipAddress = request?.headers?.get("x-forwarded-for") || "127.0.0.1";

      const { listUserSessions, recordUserSession } = await import("./account.server");

      // Record current activity
      const tokenHeader = request?.headers?.get("authorization") || "";
      const tokenHash = tokenHeader ? tokenHeader.slice(-16) : "session-current";
      await recordUserSession(userId, tokenHash, userAgent, ipAddress);

      return await listUserSessions(userId);
    } catch (err) {
      console.error("[getUserSessions error]:", err);
      return [];
    }
  });

export const revokeUserSession = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((data: { sessionId: string }) => data)
  .handler(async ({ context, data }) => {
    try {
      const { userId } = context;
      const { revokeUserSession: revoke } = await import("./account.server");
      return await revoke(userId, data.sessionId);
    } catch (err) {
      console.error("[revokeUserSession error]:", err);
      const msg = err instanceof Error ? err.message : "Failed to revoke session";
      return { ok: false as const, error: msg };
    }
  });

export const revokeAllOtherSessions = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((data?: { currentSessionId?: string }) => data || {})
  .handler(async ({ context, data }) => {
    try {
      const { userId } = context;
      const { revokeAllOtherSessions: revokeAll } = await import("./account.server");
      return await revokeAll(userId, data.currentSessionId);
    } catch (err) {
      console.error("[revokeAllOtherSessions error]:", err);
      const msg = err instanceof Error ? err.message : "Failed to revoke other sessions";
      return { ok: false as const, error: msg };
    }
  });

export const submitPhoneChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((data: unknown) => {
    const res = phoneChangeRequestSchema.safeParse(data);
    if (!res.success) {
      throw new Error(res.error.issues[0]?.message || "Invalid request details");
    }
    return res.data;
  })
  .handler(async ({ context, data }) => {
    try {
      const { userId } = context;
      const { submitPhoneChangeRequest: submitReq } = await import("./account.server");
      return await submitReq(userId, data);
    } catch (err) {
      console.error("[submitPhoneChangeRequest error]:", err);
      const msg = err instanceof Error ? err.message : "Failed to submit request";
      return { ok: false as const, error: msg };
    }
  });

export const getUserPhoneChangeRequests = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    try {
      const { userId } = context;
      const { listUserPhoneChangeRequests } = await import("./account.server");
      return await listUserPhoneChangeRequests(userId);
    } catch (err) {
      console.error("[getUserPhoneChangeRequests error]:", err);
      return [];
    }
  });

export const getAdminPhoneRequests = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    try {
      const { roles } = context;
      if (roles && !roles?.includes("super_admin") && !roles?.includes("staff")) {
        throw new Error("Forbidden: Staff or Admin role required");
      }
      const { listAdminPhoneRequests } = await import("./account.server");
      return await listAdminPhoneRequests();
    } catch (err) {
      console.error("[getAdminPhoneRequests error]:", err);
      return [];
    }
  });

export const decidePhoneChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((data: { requestId: string; approve: boolean; rejectionReason?: string }) => data)
  .handler(async ({ context, data }) => {
    try {
      const { userId, roles } = context;
      if (roles && !roles?.includes("super_admin") && !roles?.includes("staff")) {
        throw new Error("Forbidden: Staff or Admin role required");
      }
      const { decidePhoneChangeRequest: decideReq } = await import("./account.server");
      return await decideReq(userId, data.requestId, data.approve, data.rejectionReason);
    } catch (err) {
      console.error("[decidePhoneChangeRequest error]:", err);
      const msg = err instanceof Error ? err.message : "Failed to process phone change request";
      return { ok: false as const, error: msg };
    }
  });

import { DEFAULT_TERMS_MARKDOWN, DEFAULT_PRIVACY_MARKDOWN } from "./default-policies";

export const getPublicBusinessConfig = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const settings = await prisma.businessSettings.findFirst();
    return {
      businessName: settings?.businessName || process.env["BUSINESS_NAME"] || "Lending Platform",
      businessLocation: settings?.businessLocation || "Nairobi, Kenya",
      supportPhone: settings?.supportPhone || "",
      supportEmail: settings?.supportEmail || "",
      logoUrl: settings?.logoUrl || "",
      heroImageUrl: settings?.heroImageUrl || "",
      faviconUrl: settings?.faviconUrl || "",
      primaryColor: settings?.primaryColor || "",
      secondaryColor: settings?.secondaryColor || "",
      accentColor: settings?.accentColor || "",
      backgroundColor: settings?.backgroundColor || "",
      foregroundColor: settings?.foregroundColor || "",
      goldColor: settings?.goldColor || "",
      landingContent: settings?.landingContent || "",
      termsContent: settings?.termsContent || DEFAULT_TERMS_MARKDOWN,
      privacyContent: settings?.privacyContent || DEFAULT_PRIVACY_MARKDOWN,
      enable2faByEmail: Boolean(settings?.enable2faByEmail),
      lockDarajaConfig: Boolean(settings?.lockDarajaConfig),
      lockSmtpConfig: Boolean(settings?.lockSmtpConfig),
      allowActivationWithoutDisbursement: Boolean(settings?.allowActivationWithoutDisbursement),
      maxActiveLoansPerBorrower: settings?.maxActiveLoansPerBorrower ?? 1,
      requireGuarantorsForLoans: settings?.requireGuarantorsForLoans ?? true,
      autoRejectIfDefaulted: settings?.autoRejectIfDefaulted ?? true,
      lockLandingEditMode: Boolean(settings?.lockLandingEditMode),
    };
  } catch (err) {
    console.error("[getPublicBusinessConfig error]:", err);
    return {
      businessName: process.env["BUSINESS_NAME"] || "Lending Platform",
      businessLocation: "Nairobi, Kenya",
      supportPhone: "",
      supportEmail: "",
      logoUrl: "",
      faviconUrl: "",
      primaryColor: "",
      secondaryColor: "",
      accentColor: "",
      backgroundColor: "",
      foregroundColor: "",
      goldColor: "",
      landingContent: "",
      termsContent: DEFAULT_TERMS_MARKDOWN,
      privacyContent: DEFAULT_PRIVACY_MARKDOWN,
      enable2faByEmail: true,
      lockDarajaConfig: false,
      lockSmtpConfig: false,
      allowActivationWithoutDisbursement: true,
      maxActiveLoansPerBorrower: 1,
      requireGuarantorsForLoans: true,
      autoRejectIfDefaulted: true,
      lockLandingEditMode: false,
    };
  }
});

export const getPublicApprovedTestimonials = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const list = await prisma.testimonial.findMany({
      where: { status: "approved" },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    return list.map((t) => ({
      id: t.id,
      author_name: t.authorName,
      role: t.role,
      content: t.content,
      rating: t.rating,
      created_at: t.createdAt.toISOString(),
    }));
  } catch (err) {
    console.error("[getPublicApprovedTestimonials error]:", err);
    return [];
  }
});

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    try {
      const { userId } = context;
      const { deleteOwnAccount } = await import("./account.server");
      return await deleteOwnAccount(userId);
    } catch (err) {
      console.error("[deleteMyAccount error]:", err);
      const msg = err instanceof Error ? err.message : "Failed to delete account";
      return { ok: false as const, error: msg };
    }
  });

export const listTransferableAgents = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    try {
      const { userId } = context;
      const { getAgentsForRoleTransfer } = await import("./account.server");
      return await getAgentsForRoleTransfer(userId);
    } catch (err) {
      console.error("[listTransferableAgents error]:", err);
      return [];
    }
  });

export const transferAdminRole = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((data: { targetUserId: string }) => data)
  .handler(async ({ context, data }) => {
    try {
      const { userId } = context;
      const { transferInitialAdminRole } = await import("./account.server");
      return await transferInitialAdminRole(userId, data.targetUserId);
    } catch (err) {
      console.error("[transferAdminRole error]:", err);
      const msg = err instanceof Error ? err.message : "Failed to transfer role";
      return { ok: false as const, error: msg };
    }
  });

export const get2faSecuritySettings = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const [settings, profile] = await Promise.all([
      prisma.businessSettings.findFirst({
        select: { enable2faByEmail: true, smtpHost: true, smtpUser: true, smtpFromEmail: true },
      }),
      prisma.profile.findUnique({
        where: { id: userId },
        select: { is2faEnabled: true, email: true },
      }),
    ]);

    const smtpConfigured = Boolean(
      settings?.smtpHost && settings?.smtpUser && settings?.smtpFromEmail,
    );
    const allow2faByEmail = Boolean(settings?.enable2faByEmail);

    return {
      allow2faByEmail,
      smtpConfigured,
      is2faEnabled: Boolean(profile?.is2faEnabled),
      userEmail: profile?.email ?? "",
    };
  });

export const send2faCode = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const [settings, profile] = await Promise.all([
      prisma.businessSettings.findFirst({ select: { enable2faByEmail: true } }),
      prisma.profile.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      }),
    ]);

    if (settings && !settings.enable2faByEmail) {
      throw new Error("Two-Factor Authentication via email is currently disabled by System Rules.");
    }

    if (!profile) throw new Error("User profile not found.");

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.profile.update({
      where: { id: userId },
      data: {
        twoFactorCode: code,
        twoFactorCodeExpiresAt: expiresAt,
      },
    });

    try {
      const { sendEmail } = await import("./email.server");
      const settings = await prisma.businessSettings.findFirst({
        select: { businessName: true },
      });
      const bName = settings?.businessName || process.env["BUSINESS_NAME"] || "Lending Platform";
      await sendEmail({
        to: profile.email,
        subject: `${bName} 2FA Verification Code`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>Two-Factor Authentication Setup</h2>
            <p>Hello ${profile.firstName || "User"},</p>
            <p>Your 2FA security verification code is:</p>
            <h1 style="letter-spacing: 4px; color: #0284c7; background: #f0f9ff; padding: 12px; display: inline-block;">${code}</h1>
            <p>This code will expire in 10 minutes. If you did not request this code, please ignore this email.</p>
          </div>
        `,
      });
    } catch (err) {
      console.warn("[send2faCode email failed, proceeding with code]:", err);
    }

    return {
      ok: true as const,
      message: `A 6-digit verification code has been sent to ${profile.email}. Please check your inbox.`,
    };
  });

export const verifyAndToggle2fa = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((data: { code?: string; enable: boolean }) => data)
  .handler(async ({ context, data }) => {
    const { userId } = context;

    if (data.enable) {
      const settings = await prisma.businessSettings.findFirst({
        select: { enable2faByEmail: true },
      });
      if (settings && !settings.enable2faByEmail) {
        throw new Error(
          "Two-Factor Authentication via email is currently disabled by System Rules.",
        );
      }
    }

    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { is2faEnabled: true, twoFactorCode: true, twoFactorCodeExpiresAt: true },
    });
    if (!profile) throw new Error("User profile not found.");

    if (data.enable) {
      if (!data.code || data.code.trim().length === 0) {
        throw new Error("Verification code is required to enable 2FA.");
      }

      if (profile.twoFactorCode !== data.code.trim()) {
        throw new Error("Invalid verification code. Please check your email and try again.");
      }

      if (profile.twoFactorCodeExpiresAt && profile.twoFactorCodeExpiresAt < new Date()) {
        throw new Error("Verification code has expired. Please request a new code.");
      }

      await prisma.profile.update({
        where: { id: userId },
        data: {
          is2faEnabled: true,
          twoFactorCode: null,
          twoFactorCodeExpiresAt: null,
        },
      });

      return {
        ok: true as const,
        is2faEnabled: true,
        message: "Two-Factor Authentication via email enabled successfully!",
      };
    } else {
      await prisma.profile.update({
        where: { id: userId },
        data: {
          is2faEnabled: false,
          twoFactorCode: null,
          twoFactorCodeExpiresAt: null,
        },
      });

      return {
        ok: true as const,
        is2faEnabled: false,
        message: "Two-Factor Authentication disabled.",
      };
    }
  });
