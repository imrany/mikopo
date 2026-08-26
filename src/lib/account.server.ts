import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { notifyUserAccountDeleted } from "./notifications.server";
import type {
  RegisterInput,
  SetupInput,
  UpdateProfileInput,
  ChangePasswordInput,
  PhoneChangeRequestInput,
} from "./schemas";
import { signJwtToken, verifyJwtToken } from "./auth-middleware";

export type IdentifierConflict = "email" | "phone" | "id_number" | null;

export async function findConflict(input: {
  email: string;
  phone: string;
  idNumber: string;
}): Promise<IdentifierConflict> {
  const existing = await prisma.profile.findFirst({
    where: {
      OR: [
        { email: { equals: input.email, mode: "insensitive" } },
        { phone: input.phone },
        { idNumber: input.idNumber },
      ],
    },
  });
  if (!existing) return null;
  // If an unverified pending account exists with the exact same email, allow updating it during registration
  if (
    existing.status === "pending" &&
    !existing.emailVerified &&
    existing.email.toLowerCase() === input.email.toLowerCase()
  ) {
    const otherConflicting = await prisma.profile.findFirst({
      where: {
        id: { not: existing.id },
        OR: [{ phone: input.phone }, { idNumber: input.idNumber }],
      },
    });
    if (otherConflicting) {
      if (otherConflicting.phone === input.phone) return "phone";
      if (otherConflicting.idNumber === input.idNumber) return "id_number";
    }
    return null;
  }
  if (existing.email.toLowerCase() === input.email.toLowerCase()) return "email";
  if (existing.phone === input.phone) return "phone";
  if (existing.idNumber === input.idNumber) return "id_number";
  return null;
}

export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  if (identifier.includes("@")) return identifier.toLowerCase();
  const digits = identifier.replace(/\D/g, "");
  const profile = await prisma.profile.findFirst({
    where: {
      OR: [
        { phone: digits },
        { idNumber: digits },
        { phone: `+${digits}` },
        { phone: digits.startsWith("254") ? digits : `254${digits.replace(/^0/, "")}` },
      ],
    },
    select: { email: true },
  });
  return profile?.email ?? null;
}

export async function isAccountUsable(email: string) {
  const profile = await prisma.profile.findUnique({
    where: { email: email.toLowerCase() },
    select: { status: true },
  });
  return profile?.status !== "suspended";
}

export async function adminExists(): Promise<boolean> {
  try {
    const count = await prisma.userRole.count({
      where: { role: { in: ["super_admin", "staff"] } },
    });
    return count > 0;
  } catch (err) {
    console.warn("[adminExists check error]:", err);
    return false;
  }
}

export async function setupCompleted(): Promise<boolean> {
  try {
    const settings = await prisma.businessSettings.findFirst({
      select: { setupCompleted: true },
    });
    return Boolean(settings?.setupCompleted);
  } catch (err) {
    console.warn("[setupCompleted check error]:", err);
    return false;
  }
}

function generateReferralCode(): string {
  const uuid = crypto.randomUUID().replace(/-/g, "").toUpperCase();
  return uuid.slice(0, 7);
}

export async function createFirstAdmin(input: SetupInput) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const email = input.email.toLowerCase();

  const user = await prisma.$transaction(async (tx) => {
    const profile = await tx.profile.create({
      data: {
        email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
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
        role: "super_admin",
      },
    });

    await tx.newsletterSubscriber.upsert({
      where: { email },
      create: { email },
      update: {},
    });

    const existingSettings = await tx.businessSettings.findFirst();
    if (existingSettings) {
      await tx.businessSettings.update({
        where: { id: existingSettings.id },
        data: {
          businessName: input.businessName,
          businessLocation: input.businessLocation,
          supportEmail: input.supportEmail || null,
          supportPhone: input.supportPhone || null,
          mpesaShortcode: input.mpesaShortcode || null,
          mpesaAccountNumber: input.mpesaAccountNumber || null,
          mpesaEnvironment: input.mpesaEnvironment || "sandbox",
          mpesaCallbackUrl: input.mpesaCallbackUrl || null,
          setupCompleted: true,
        },
      });
    } else {
      await tx.businessSettings.create({
        data: {
          businessName: input.businessName,
          businessLocation: input.businessLocation,
          supportEmail: input.supportEmail || null,
          supportPhone: input.supportPhone || null,
          mpesaShortcode: input.mpesaShortcode || null,
          mpesaAccountNumber: input.mpesaAccountNumber || null,
          mpesaEnvironment: input.mpesaEnvironment || "sandbox",
          mpesaCallbackUrl: input.mpesaCallbackUrl || null,
          setupCompleted: true,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: profile.id,
        action: "setup.completed",
        targetType: "business_settings",
        details: { business_name: input.businessName },
      },
    });

    return profile;
  });

  return { userId: user.id };
}

export async function createMember(input: RegisterInput) {
  const [hasAdmin, completed] = await Promise.all([adminExists(), setupCompleted()]);
  if (!hasAdmin || !completed) {
    throw new Error("Initial admin setup is required before member registrations are accepted.");
  }

  const conflict = await findConflict({
    email: input.email.toLowerCase(),
    phone: input.phone,
    idNumber: input.idNumber,
  });
  if (conflict) return { conflict, requiresVerification: false };

  const passwordHash = await bcrypt.hash(input.password, 10);
  const email = input.email.toLowerCase();

  let referrerId: string | null = null;
  if (input.referralCode) {
    const refOwner = await prisma.profile.findFirst({
      where: { referralCode: { equals: input.referralCode, mode: "insensitive" } },
      select: { id: true },
    });
    if (refOwner) referrerId = refOwner.id;
  }

  const { getSmtpConfig, sendEmailVerificationCode } = await import("./email.server");
  const smtpConfig = await getSmtpConfig();
  const requiresVerification = Boolean(smtpConfig);

  const verificationCode = requiresVerification
    ? Math.floor(100000 + Math.random() * 900000).toString()
    : null;
  const verificationExpiry = requiresVerification
    ? new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    : null;

  // Check if updating an existing pending unverified user with the same email
  const existingPending = await prisma.profile.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      emailVerified: false,
      status: "pending",
    },
  });

  let user;
  if (existingPending) {
    user = await prisma.profile.update({
      where: { id: existingPending.id },
      data: {
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        idNumber: input.idNumber,
        referredBy: referrerId,
        emailVerified: !requiresVerification,
        status: requiresVerification ? "pending" : "active",
        twoFactorCode: verificationCode,
        twoFactorCodeExpiresAt: verificationExpiry,
      },
    });
  } else {
    user = await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.create({
        data: {
          email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          idNumber: input.idNumber,
          referralCode: generateReferralCode(),
          referredBy: referrerId,
          emailVerified: !requiresVerification,
          status: requiresVerification ? "pending" : "active",
          twoFactorCode: verificationCode,
          twoFactorCodeExpiresAt: verificationExpiry,
        },
      });

      await tx.userRole.upsert({
        where: {
          userId_role: {
            userId: profile.id,
            role: "user",
          },
        },
        create: {
          userId: profile.id,
          role: "user",
        },
        update: {},
      });

      await tx.newsletterSubscriber.upsert({
        where: { email },
        create: { email },
        update: {},
      });

      return profile;
    });
  }

  if (requiresVerification && verificationCode) {
    try {
      await sendEmailVerificationCode({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        code: verificationCode,
      });
    } catch (err) {
      console.warn("[createMember email send error]:", err);
    }

    const tempToken = await signJwtToken({
      sub: user.id,
      email: user.email,
      type: "email_verification",
      roles: ["email_verification"],
    });

    const maskedEmail = maskEmailForDisplay(user.email);

    return {
      conflict: null as IdentifierConflict,
      requiresVerification: true as const,
      tempToken,
      maskedEmail,
      userId: user.id,
    };
  }

  try {
    const { notifyNewUserRegistered } = await import("./notifications.server");
    await notifyNewUserRegistered({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || undefined,
    });
  } catch (err) {
    console.error("[createMember notification error]:", err);
  }

  return {
    conflict: null as IdentifierConflict,
    requiresVerification: false as const,
    userId: user.id,
  };
}

export async function verifyRegistrationEmail(tempToken: string, code: string) {
  const claims = await verifyJwtToken(tempToken);
  if (!claims || !claims.sub || claims.type !== "email_verification") {
    return {
      ok: false as const,
      error: "Verification session expired. Please register again or request a new code.",
    };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: claims.sub },
    include: { roles: true },
  });

  if (!profile) {
    return { ok: false as const, error: "Account not found. Please register again." };
  }

  if (profile.status === "suspended") {
    return { ok: false as const, error: "This account is suspended. Please contact support." };
  }

  if (!profile.twoFactorCode || profile.twoFactorCode !== code.trim()) {
    return {
      ok: false as const,
      error: "Invalid 6-digit verification code. Please check your email and try again.",
    };
  }

  if (profile.twoFactorCodeExpiresAt && profile.twoFactorCodeExpiresAt < new Date()) {
    return {
      ok: false as const,
      error: "Verification code has expired. Please click Resend Code to receive a new code.",
    };
  }

  const updated = await prisma.profile.update({
    where: { id: profile.id },
    data: {
      emailVerified: true,
      status: "active",
      twoFactorCode: null,
      twoFactorCodeExpiresAt: null,
    },
    include: { roles: true },
  });

  try {
    const { notifyNewUserRegistered } = await import("./notifications.server");
    await notifyNewUserRegistered({
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      phone: updated.phone || undefined,
    });
  } catch (err) {
    console.error("[verifyRegistrationEmail notification error]:", err);
  }

  const roles = updated.roles.map((r: { role: string }) => r.role);
  const token = await signJwtToken({
    sub: updated.id,
    email: updated.email,
    roles,
  });

  return {
    ok: true as const,
    token,
    user: {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      phone: updated.phone,
      roles,
    },
  };
}

export async function resendRegistrationCode(tempToken: string) {
  const claims = await verifyJwtToken(tempToken);
  if (!claims || !claims.sub || claims.type !== "email_verification") {
    return { ok: false as const, error: "Verification session expired. Please register again." };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: claims.sub },
  });

  if (!profile) {
    return { ok: false as const, error: "Account not found." };
  }

  if (profile.emailVerified && profile.status === "active") {
    return { ok: false as const, error: "Account is already verified. You can now sign in." };
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      twoFactorCode: code,
      twoFactorCodeExpiresAt: expiresAt,
    },
  });

  const { sendEmailVerificationCode } = await import("./email.server");
  await sendEmailVerificationCode({
    email: profile.email,
    name: `${profile.firstName} ${profile.lastName}`,
    code,
  });

  const maskedEmail = maskEmailForDisplay(profile.email);
  return {
    ok: true as const,
    maskedEmail,
    message: `A new verification code was sent to ${maskedEmail}.`,
  };
}

function maskEmailForDisplay(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const maskedLocal =
    local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}

export async function loginUser(identifier: string, password: string) {
  const email = await resolveLoginEmail(identifier);
  if (!email) {
    return { ok: false as const, error: "No account matches those credentials." };
  }

  const profile = await prisma.profile.findUnique({
    where: { email },
    include: { roles: true },
  });

  if (!profile || !profile.passwordHash) {
    return { ok: false as const, error: "No account matches those credentials." };
  }

  if (profile.status === "suspended") {
    return { ok: false as const, error: "This account is suspended. Contact support." };
  }

  const validPassword = await bcrypt.compare(password, profile.passwordHash);
  if (!validPassword) {
    return { ok: false as const, error: "No account matches those credentials." };
  }

  // If email verification is required and account is pending/unverified
  if (!profile.emailVerified && profile.status === "pending") {
    const { getSmtpConfig, sendEmailVerificationCode } = await import("./email.server");
    const smtpConfig = await getSmtpConfig();
    if (smtpConfig) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await prisma.profile.update({
        where: { id: profile.id },
        data: {
          twoFactorCode: code,
          twoFactorCodeExpiresAt: expiresAt,
        },
      });
      await sendEmailVerificationCode({
        email: profile.email,
        name: `${profile.firstName} ${profile.lastName}`,
        code,
      });
      const tempToken = await signJwtToken({
        sub: profile.id,
        email: profile.email,
        type: "email_verification",
        roles: ["email_verification"],
      });
      const maskedEmail = maskEmailForDisplay(profile.email);
      return {
        ok: false as const,
        requiresEmailVerification: true as const,
        tempToken,
        maskedEmail,
        error: `Please verify your email address to activate your account. A 6-digit verification code has been sent to ${maskedEmail}.`,
      };
    } else {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { status: "active", emailVerified: true },
      });
    }
  }

  // Check if user has Two-Factor Authentication (2FA) enabled
  if (profile.is2faEnabled) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        twoFactorCode: code,
        twoFactorCodeExpiresAt: expiresAt,
      },
    });

    const tempToken = await signJwtToken({
      sub: profile.id,
      email: profile.email,
      roles: ["2fa_challenge"],
    });

    const maskedEmail = maskEmailForDisplay(profile.email);

    try {
      const { sendEmail } = await import("./email.server");
      const settings = await prisma.businessSettings.findFirst({
        select: { businessName: true },
      });
      const bName = settings?.businessName || process.env["BUSINESS_NAME"] || "Lending Platform";
      await sendEmail({
        to: profile.email,
        subject: `${bName} - 2FA Sign-In Verification Code`,
        html: `
          <div style="font-family: sans-serif; padding: 24px; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #0f172a; margin-top: 0;">Sign-In Verification (2FA)</h2>
            <p style="color: #475569; font-size: 14px;">Hello ${profile.firstName || "Member"},</p>
            <p style="color: #475569; font-size: 14px;">A sign-in request was initiated for your account. Please use the following 6-digit security code to complete your login:</p>
            <div style="text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0284c7; background: #f0f9ff; padding: 14px 24px; border-radius: 8px; display: inline-block; border: 1px solid #bae6fd;">
                ${code}
              </span>
            </div>
            <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">This code expires in 10 minutes. If you did not initiate this login attempt, please secure your account immediately.</p>
          </div>
        `,
      });
    } catch (err) {
      console.warn("[2FA sign-in email send error, code provided in fallback]:", err);
    }

    return {
      ok: true as const,
      requires2fa: true as const,
      tempToken,
      maskedEmail,
      message: `A 6-digit security verification code was sent to ${maskedEmail}.`,
    };
  }

  const roles = profile.roles.map((r: { role: string }) => r.role);
  const token = await signJwtToken({
    sub: profile.id,
    email: profile.email,
    roles,
  });

  return {
    ok: true as const,
    requires2fa: false as const,
    token,
    user: {
      id: profile.id,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      roles,
    },
  };
}

export async function verify2faLogin(tempToken: string, code: string) {
  const claims = await verifyJwtToken(tempToken);
  if (!claims || !claims.sub) {
    return { ok: false as const, error: "Verification session expired. Please sign in again." };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: claims.sub },
    include: { roles: true },
  });

  if (!profile || profile.status === "suspended") {
    return { ok: false as const, error: "Account not found or suspended." };
  }

  if (!profile.twoFactorCode || profile.twoFactorCode !== code.trim()) {
    return {
      ok: false as const,
      error: "Invalid 2FA verification code. Please check and try again.",
    };
  }

  if (profile.twoFactorCodeExpiresAt && profile.twoFactorCodeExpiresAt < new Date()) {
    return {
      ok: false as const,
      error: "Verification code has expired. Please request a new code.",
    };
  }

  // Clear 2FA code upon successful verification
  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      twoFactorCode: null,
      twoFactorCodeExpiresAt: null,
    },
  });

  const roles = profile.roles.map((r: { role: string }) => r.role);
  const token = await signJwtToken({
    sub: profile.id,
    email: profile.email,
    roles,
  });

  return {
    ok: true as const,
    token,
    user: {
      id: profile.id,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      roles,
    },
  };
}

export async function resend2faLoginCode(tempToken: string) {
  const claims = await verifyJwtToken(tempToken);
  if (!claims || !claims.sub) {
    return { ok: false as const, error: "Verification session expired. Please sign in again." };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: claims.sub },
  });

  if (!profile || profile.status === "suspended") {
    return { ok: false as const, error: "Account not found or suspended." };
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      twoFactorCode: code,
      twoFactorCodeExpiresAt: expiresAt,
    },
  });

  const maskedEmail = maskEmailForDisplay(profile.email);

  try {
    const { sendEmail } = await import("./email.server");
    const settings = await prisma.businessSettings.findFirst({
      select: { businessName: true },
    });
    const bName = settings?.businessName || process.env["BUSINESS_NAME"] || "Lending Platform";
    await sendEmail({
      to: profile.email,
      subject: `${bName} - 2FA Sign-In Verification Code`,
      html: `
        <div style="font-family: sans-serif; padding: 24px; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #0f172a; margin-top: 0;">Sign-In Verification (2FA)</h2>
          <p style="color: #475569; font-size: 14px;">Hello ${profile.firstName || "Member"},</p>
          <p style="color: #475569; font-size: 14px;">Here is your new 6-digit security code to complete your login:</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0284c7; background: #f0f9ff; padding: 14px 24px; border-radius: 8px; display: inline-block; border: 1px solid #bae6fd;">
              ${code}
            </span>
          </div>
          <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">This code expires in 10 minutes.</p>
        </div>
      `,
    });
  } catch (err) {
    console.warn("[2FA resend email error, code provided in fallback]:", err);
  }

  return {
    ok: true as const,
    message: `A new 6-digit verification code was sent to ${maskedEmail}.`,
  };
}

export async function updateUserProfile(userId: string, input: UpdateProfileInput) {
  const existing = await prisma.profile.findUnique({
    where: { id: userId },
  });

  if (!existing) {
    return { ok: false as const, error: "User account not found." };
  }

  // Check if idNumber conflicts with another existing account
  const conflict = await prisma.profile.findFirst({
    where: {
      id: { not: userId },
      idNumber: input.idNumber,
    },
  });

  if (conflict) {
    return {
      ok: false as const,
      error: "That ID number is already registered to another account.",
    };
  }

  await prisma.profile.update({
    where: { id: userId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      idNumber: input.idNumber,
    },
  });

  return { ok: true as const };
}

export async function changeUserPassword(userId: string, input: ChangePasswordInput) {
  const user = await prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, passwordHash: true, email: true },
  });

  if (!user || !user.passwordHash) {
    return { ok: false as const, error: "User account not found." };
  }

  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) {
    return { ok: false as const, error: "The current password you entered is incorrect." };
  }

  if (input.currentPassword === input.newPassword) {
    return {
      ok: false as const,
      error: "New password cannot be identical to your current password.",
    };
  }

  // Enforce password complexity
  const hasUpperCase = /[A-Z]/.test(input.newPassword);
  const hasLowerCase = /[a-z]/.test(input.newPassword);
  const hasNumber = /\d/.test(input.newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(input.newPassword);

  if (input.newPassword.length < 8 || !hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecial) {
    return {
      ok: false as const,
      error:
        "Password must be at least 8 characters and include uppercase, lowercase, numbers, and a special symbol.",
    };
  }

  const newHash = await bcrypt.hash(input.newPassword, 10);
  await prisma.profile.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  });

  // Security action: Terminate other stored sessions for this user
  try {
    await prisma.userSession.deleteMany({
      where: { userId },
    });
  } catch (err) {
    console.warn("[changeUserPassword session cleanup notice]:", err);
  }

  // Send Security Notification Email
  try {
    const { sendEmail } = await import("./email.server");
    const settings = await prisma.businessSettings.findFirst({
      select: { businessName: true },
    });
    const bName = settings?.businessName || process.env["BUSINESS_NAME"] || "Lending Platform";
    await sendEmail({
      to: user.email,
      subject: `Security Alert: Password Changed — ${bName}`,
      html: `
        <div style="font-family: sans-serif; padding: 24px; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Security Alert: Password Changed</h2>
          <p style="color: #475569; font-size: 14px;">Hello ${user.firstName || "Member"},</p>
          <p style="color: #475569; font-size: 14px;">The password for your ${bName} account (<strong>${user.email}</strong>) was successfully changed.</p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px; margin: 18px 0; font-size: 13px; color: #334155;">
            <p style="margin: 0 0 6px 0;"><strong>Date & Time:</strong> ${new Date().toUTCString()}</p>
            <p style="margin: 0;"><strong>Security Protection:</strong> Other device sessions have been invalidated for your safety.</p>
          </div>
          <p style="color: #dc2626; font-size: 13px; margin-bottom: 0;">If you did not perform this change, please contact support immediately to lock your account.</p>
        </div>
      `,
    });
  } catch (err) {
    console.warn("[changeUserPassword security email notice]:", err);
  }

  // Log audit
  await prisma.auditLog.create({
    data: {
      actorId: userId,
      action: "user.password_changed",
      targetType: "profile",
      targetId: userId,
      details: { email: user.email, sessionInvalidated: true },
    },
  });

  return { ok: true as const };
}

export async function recordUserSession(
  userId: string,
  tokenHash: string,
  userAgent: string,
  ipAddress: string,
) {
  try {
    let deviceInfo = "Web Browser";
    const ua = userAgent.toLowerCase();

    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
      if (ua.includes("iphone")) deviceInfo = "Mobile (iPhone / Safari)";
      else if (ua.includes("android")) deviceInfo = "Mobile (Android)";
      else deviceInfo = "Mobile Device";
    } else if (ua.includes("windows")) {
      deviceInfo = "Desktop (Windows)";
    } else if (ua.includes("macintosh") || ua.includes("mac os")) {
      deviceInfo = "Desktop (macOS)";
    } else if (ua.includes("linux")) {
      deviceInfo = "Desktop (Linux)";
    }

    const existing = await prisma.userSession.findFirst({
      where: { userId, tokenHash },
    });

    if (existing) {
      await prisma.userSession.update({
        where: { id: existing.id },
        data: {
          lastActiveAt: new Date(),
          ipAddress: ipAddress || existing.ipAddress,
          userAgent: userAgent || existing.userAgent,
          deviceInfo,
        },
      });
    } else {
      await prisma.userSession.create({
        data: {
          userId,
          tokenHash,
          deviceInfo,
          ipAddress: ipAddress || "127.0.0.1",
          userAgent,
          lastActiveAt: new Date(),
        },
      });
    }
  } catch (err) {
    console.error("[recordUserSession error]:", err);
  }
}

export async function listUserSessions(userId: string) {
  const sessions = await prisma.userSession.findMany({
    where: { userId },
    orderBy: { lastActiveAt: "desc" },
  });

  return sessions.map((s) => ({
    id: s.id,
    deviceInfo: s.deviceInfo,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    lastActiveAt: s.lastActiveAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
  }));
}

export async function revokeUserSession(userId: string, sessionId: string) {
  const session = await prisma.userSession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) {
    return { ok: false as const, error: "Session not found." };
  }

  await prisma.userSession.delete({
    where: { id: sessionId },
  });

  return { ok: true as const };
}

export async function revokeAllOtherSessions(userId: string, currentSessionId?: string) {
  await prisma.userSession.deleteMany({
    where: {
      userId,
      id: currentSessionId ? { not: currentSessionId } : undefined,
    },
  });

  return { ok: true as const };
}

export async function submitPhoneChangeRequest(userId: string, input: PhoneChangeRequestInput) {
  const user = await prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });

  if (!user) {
    return { ok: false as const, error: "User profile not found." };
  }

  if (user.phone === input.requestedPhone) {
    return {
      ok: false as const,
      error: "The requested phone number is identical to your current phone number.",
    };
  }

  // Check if requested phone is already registered to another user
  const phoneExists = await prisma.profile.findFirst({
    where: {
      id: { not: userId },
      phone: input.requestedPhone,
    },
  });

  if (phoneExists) {
    return {
      ok: false as const,
      error: "The requested phone number is already registered to another account.",
    };
  }

  // Check if user already has a pending phone change request
  const pending = await prisma.phoneChangeRequest.findFirst({
    where: {
      userId,
      status: "pending",
    },
  });

  if (pending) {
    return {
      ok: false as const,
      error:
        "You already have a pending phone change request. Please wait for administrator approval.",
    };
  }

  const reqRecord = await prisma.phoneChangeRequest.create({
    data: {
      userId,
      currentPhone: user.phone || "—",
      requestedPhone: input.requestedPhone,
      reason: input.reason,
      status: "pending",
    },
  });

  // Notify administrators
  try {
    await prisma.notification.create({
      data: {
        roleTarget: "super_admin",
        title: "Phone Change Request",
        message: `${user.firstName} ${user.lastName} requested to change phone from ${user.phone || "—"} to ${input.requestedPhone}. Reason: ${input.reason}`,
        type: "warning",
      },
    });
  } catch (err) {
    console.error("[submitPhoneChangeRequest notify error]:", err);
  }

  return { ok: true as const, requestId: reqRecord.id };
}

export async function listUserPhoneChangeRequests(userId: string) {
  const requests = await prisma.phoneChangeRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return requests.map((r) => ({
    id: r.id,
    currentPhone: r.currentPhone,
    requestedPhone: r.requestedPhone,
    reason: r.reason,
    status: r.status,
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function listAdminPhoneRequests() {
  const requests = await prisma.phoneChangeRequest.findMany({
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: `${r.user.firstName} ${r.user.lastName}`.trim() || r.user.email,
    userEmail: r.user.email,
    currentPhone: r.currentPhone,
    requestedPhone: r.requestedPhone,
    reason: r.reason,
    status: r.status,
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function decidePhoneChangeRequest(
  adminId: string,
  requestId: string,
  approve: boolean,
  rejectionReason?: string,
) {
  const request = await prisma.phoneChangeRequest.findUnique({
    where: { id: requestId },
    include: { user: true },
  });

  if (!request) {
    return { ok: false as const, error: "Phone change request not found." };
  }

  if (request.status !== "pending") {
    return { ok: false as const, error: `Request has already been ${request.status}.` };
  }

  if (approve) {
    // Check if phone number is taken by another profile in the meantime
    const conflict = await prisma.profile.findFirst({
      where: {
        id: { not: request.userId },
        phone: request.requestedPhone,
      },
    });

    if (conflict) {
      return {
        ok: false as const,
        error: "Cannot approve: Requested phone number is now registered to another account.",
      };
    }

    await prisma.$transaction([
      prisma.profile.update({
        where: { id: request.userId },
        data: { phone: request.requestedPhone, phoneVerified: true },
      }),
      prisma.phoneChangeRequest.update({
        where: { id: requestId },
        data: { status: "approved" },
      }),
      prisma.notification.create({
        data: {
          userId: request.userId,
          title: "Phone Number Updated",
          message: `Your request to change your phone number to ${request.requestedPhone} has been approved.`,
          type: "success",
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: "phone_change.approved",
          targetType: "phone_change_request",
          targetId: requestId,
          details: {
            userId: request.userId,
            oldPhone: request.currentPhone,
            newPhone: request.requestedPhone,
          },
        },
      }),
    ]);

    return { ok: true as const };
  } else {
    await prisma.$transaction([
      prisma.phoneChangeRequest.update({
        where: { id: requestId },
        data: {
          status: "rejected",
          rejectionReason: rejectionReason || "Request declined by administration",
        },
      }),
      prisma.notification.create({
        data: {
          userId: request.userId,
          title: "Phone Change Request Declined",
          message: `Your request to change phone number to ${request.requestedPhone} was declined. Reason: ${rejectionReason || "Declined by administration"}`,
          type: "error",
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: "phone_change.rejected",
          targetType: "phone_change_request",
          targetId: requestId,
          details: {
            userId: request.userId,
            requestedPhone: request.requestedPhone,
            reason: rejectionReason,
          },
        },
      }),
    ]);

    return { ok: true as const };
  }
}

export async function deleteOwnAccount(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  });

  if (!profile) {
    return { ok: false as const, error: "Account not found." };
  }

  const initialAdminRole = await prisma.userRole.findFirst({
    where: { role: "super_admin" },
    orderBy: { createdAt: "asc" },
  });

  if (initialAdminRole && initialAdminRole.userId === userId) {
    return {
      ok: false as const,
      error:
        "The Initial Admin account cannot be deleted. Please transfer your Initial Admin role to another agent first.",
    };
  }

  const superAdminRole = await prisma.userRole.findFirst({
    where: { userId, role: "super_admin" },
  });

  if (superAdminRole) {
    return {
      ok: false as const,
      error:
        "Super Admin accounts cannot be directly deleted. Transfer your role or contact management.",
    };
  }

  const activeLoan = await prisma.loan.findFirst({
    where: {
      userId,
      status: {
        notIn: ["repaid", "rejected"],
      },
    },
    select: { id: true, status: true },
  });

  if (activeLoan) {
    return {
      ok: false as const,
      error:
        "You cannot delete your account while you have an active or pending loan. Please clear all outstanding loans first.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.userSession.deleteMany({ where: { userId } });
    await tx.userRole.deleteMany({ where: { userId } });
    await tx.userGuarantor.deleteMany({ where: { userId } });
    await tx.phoneChangeRequest.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.profile.delete({ where: { id: userId } });
  });

  await notifyUserAccountDeleted({
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    phone: profile.phone,
    deletedBy: "user",
  });

  return { ok: true as const };
}

export async function getAgentsForRoleTransfer(actorId: string) {
  const initialAdmin = await prisma.userRole.findFirst({
    where: { role: "super_admin" },
    orderBy: { createdAt: "asc" },
  });

  if (!initialAdmin || initialAdmin.userId !== actorId) {
    throw new Error("Forbidden: Only the Initial Admin can view transferable agents.");
  }

  const staffRoles = await prisma.userRole.findMany({
    where: {
      role: "staff",
      userId: { not: actorId },
    },
    select: { userId: true },
  });

  const staffUserIds = Array.from(new Set(staffRoles.map((r) => r.userId)));

  const profiles = await prisma.profile.findMany({
    where: {
      id: { in: staffUserIds },
      status: "active",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
    orderBy: { firstName: "asc" },
  });

  return profiles.map((p) => ({
    id: p.id,
    name: `${p.firstName} ${p.lastName}`.trim(),
    email: p.email,
    phone: p.phone,
  }));
}

export async function transferInitialAdminRole(actorId: string, targetUserId: string) {
  const initialAdmin = await prisma.userRole.findFirst({
    where: { role: "super_admin" },
    orderBy: { createdAt: "asc" },
  });

  if (!initialAdmin || initialAdmin.userId !== actorId) {
    return {
      ok: false as const,
      error: "Forbidden: Only the Initial Admin can perform this role transfer.",
    };
  }

  if (actorId === targetUserId) {
    return { ok: false as const, error: "Target agent cannot be yourself." };
  }

  const targetProfile = await prisma.profile.findUnique({
    where: { id: targetUserId },
    include: { roles: true },
  });

  if (!targetProfile || targetProfile.status !== "active") {
    return { ok: false as const, error: "Target agent account was not found or is inactive." };
  }

  const isStaff = targetProfile.roles.some((r) => r.role === "staff");
  if (!isStaff) {
    return {
      ok: false as const,
      error: "Role can only be transferred to an active Agent (staff user).",
    };
  }

  const fullPermissions = [
    "manage_users",
    "manage_agents",
    "manage_products",
    "approve_loans",
    "disburse_loans",
    "manage_testimonials",
    "manage_phone_requests",
    "manage_settings",
    "receive_system_alerts",
  ];

  await prisma.$transaction(async (tx) => {
    const hasSuperAdmin = targetProfile.roles.some((r) => r.role === "super_admin");
    if (!hasSuperAdmin) {
      await tx.userRole.create({
        data: {
          userId: targetUserId,
          role: "super_admin",
        },
      });
    }

    await tx.userRole.updateMany({
      where: { userId: targetUserId, role: "staff" },
      data: { permissions: fullPermissions },
    });

    await tx.userRole.deleteMany({
      where: {
        userId: actorId,
        role: { in: ["super_admin", "staff"] },
      },
    });

    // Reset target admin profile score & limit to 0
    await tx.profile.update({
      where: { id: targetUserId },
      data: { credibilityScore: 0, loanLimit: 0 },
    });

    // Reset former admin profile to base borrower score & limit
    await tx.profile.update({
      where: { id: actorId },
      data: { credibilityScore: 300, loanLimit: 1000, isEarningPointsFrozen: false },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: "role.transferred_initial_admin",
        targetType: "user",
        targetId: targetUserId,
        details: {
          transferredFrom: actorId,
          transferredTo: targetUserId,
        },
      },
    });
  });

  return { ok: true as const };
}
