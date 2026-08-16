import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireCustomAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";

const smtpSchema = z.object({
  smtpHost: z.string().trim().min(1, "SMTP Host is required"),
  smtpPort: z.number().int().min(1).max(65535),
  smtpUser: z.string().trim().min(1, "SMTP Username is required"),
  smtpPass: z.string().trim().optional(),
  smtpFromEmail: z.string().trim().email("Valid From Email required"),
  smtpFromName: z.string().trim().min(1, "From Name required"),
  smtpSecure: z.boolean().default(false),
});

// 1. Get SMTP Settings
export const getAdminSmtpSettings = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const settings = await prisma.businessSettings.findFirst({
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPass: true,
        smtpFromEmail: true,
        smtpFromName: true,
        smtpSecure: true,
      },
    });

    const host = settings?.smtpHost || process.env.SMTP_HOST;
    const user = settings?.smtpUser || process.env.SMTP_USER;
    const pass = settings?.smtpPass || process.env.SMTP_PASS;
    const fromEmail =
      settings?.smtpFromEmail || process.env.SMTP_FROM_EMAIL || settings?.supportEmail || user;
    const isConfigured = Boolean(host && user && pass && fromEmail);

    return {
      isConfigured,
      smtpHost: settings?.smtpHost || "",
      smtpPort: settings?.smtpPort || 587,
      smtpUser: settings?.smtpUser || "",
      hasPassword: Boolean(settings?.smtpPass),
      smtpFromEmail: settings?.smtpFromEmail || "",
      smtpFromName:
        settings?.smtpFromName ||
        settings?.businessName ||
        process.env.BUSINESS_NAME ||
        "Lending Platform",
      smtpSecure: settings?.smtpSecure ?? false,
    };
  });

// 2. Save SMTP Settings
export const saveAdminSmtpSettings = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => smtpSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { roles, userId } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const firstSettings = await prisma.businessSettings.findFirst();
    if (!firstSettings) throw new Error("Business settings not initialized.");

    if (firstSettings.lockSmtpConfig) {
      throw new Error(
        "SMTP Email configuration is locked by Admin Rules. To make changes, unlock it in Admin Rules console.",
      );
    }

    const updateData: Record<string, unknown> = {
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpUser: data.smtpUser,
      smtpFromEmail: data.smtpFromEmail,
      smtpFromName: data.smtpFromName,
      smtpSecure: data.smtpSecure,
    };

    if (data.smtpPass && data.smtpPass.trim().length > 0) {
      updateData.smtpPass = data.smtpPass;
    }

    await prisma.businessSettings.update({
      where: { id: firstSettings.id },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "smtp.settings_updated",
        targetType: "business_settings",
        targetId: firstSettings.id,
      },
    });

    return { ok: true as const, message: "SMTP configuration saved successfully." };
  });

// 3. Test SMTP Connection
export const testAdminSmtpConnection = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ recipientEmail: z.string().email() }).parse(input))
  .handler(async ({ data, context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const { sendEmail } = await import("./email.server");
    const { prisma } = await import("./prisma");
    const settings = await prisma.businessSettings.findFirst();
    const bName = (
      settings?.businessName ||
      process.env["BUSINESS_NAME"] ||
      "Lending Platform"
    ).trim();

    const result = await sendEmail({
      to: data.recipientEmail,
      subject: `${bName}: Test Email Configuration`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #2563eb;">SMTP Setup Successful!</h2>
          <p>Congratulations! Your ${bName} SMTP email configuration is working properly.</p>
          <p>Time sent: ${new Date().toLocaleString("en-KE")}</p>
        </div>
      `,
    });

    if (!result.sent) {
      throw new Error(result.error || result.reason || "Failed to send test email");
    }

    return { ok: true as const, message: `Test email sent to ${data.recipientEmail}` };
  });

// 4. Send Broadcast Email to Specific User, All Users, or Newsletter Subscribers
const broadcastSchema = z.object({
  target: z.enum([
    "all_users",
    "specific_user",
    "newsletter_subscribers",
    "all_including_subscribers",
  ]),
  specificUserId: z.string().uuid().optional(),
  subject: z.string().trim().min(3, "Subject is required"),
  message: z.string().trim().min(10, "Message content is required"),
  sendInAppNotification: z.boolean().default(true),
});

export const sendAdminBroadcastEmail = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => broadcastSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { roles, userId } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    let recipients: string[] = [];
    let userIdsToNotifyInApp: string[] = [];

    if (data.target === "specific_user") {
      if (!data.specificUserId) throw new Error("Please select a user");
      const targetUser = await prisma.profile.findUnique({
        where: { id: data.specificUserId },
        select: { id: true, email: true },
      });
      if (!targetUser) throw new Error("Target user not found");
      recipients = [targetUser.email];
      userIdsToNotifyInApp = [targetUser.id];
    } else if (data.target === "all_users") {
      const activeUsers = await prisma.profile.findMany({
        where: { status: "active" },
        select: { id: true, email: true },
      });
      recipients = activeUsers.map((u) => u.email);
      userIdsToNotifyInApp = activeUsers.map((u) => u.id);
    } else if (data.target === "newsletter_subscribers") {
      const subscribers = await prisma.newsletterSubscriber.findMany({ select: { email: true } });
      recipients = subscribers.map((s) => s.email);
    } else if (data.target === "all_including_subscribers") {
      const activeUsers = await prisma.profile.findMany({
        where: { status: "active" },
        select: { id: true, email: true },
      });
      const subscribers = await prisma.newsletterSubscriber.findMany({ select: { email: true } });

      recipients = Array.from(
        new Set([...activeUsers.map((u) => u.email), ...subscribers.map((s) => s.email)]),
      );
      userIdsToNotifyInApp = activeUsers.map((u) => u.id);
    }

    if (recipients.length === 0) {
      throw new Error("No recipients found for the selected target group.");
    }

    const { getSmtpConfig, sendBroadcastEmail } = await import("./email.server");
    const smtpConfig = await getSmtpConfig();
    if (!smtpConfig) {
      throw new Error(
        "SMTP is not configured. Email broadcast features are disabled until valid SMTP configuration is saved in Business Settings.",
      );
    }

    const { createInAppNotification } = await import("./notifications.server");

    // Format HTML email
    const formattedHtml = `
      <div style="font-size: 15px; line-height: 1.6;">
        ${data.message.replace(/\n/g, "<br/>")}
      </div>
    `;

    // Send emails in background
    const emailResult = await sendBroadcastEmail({
      recipients,
      subject: data.subject,
      bodyContent: formattedHtml,
    });

    // In-app notifications
    if (data.sendInAppNotification) {
      if (data.target === "all_users" || data.target === "all_including_subscribers") {
        await createInAppNotification({
          roleTarget: "all",
          title: data.subject,
          message: data.message.slice(0, 200) + (data.message.length > 200 ? "..." : ""),
          type: "announcement",
        });
      } else {
        for (const targetUid of userIdsToNotifyInApp) {
          await createInAppNotification({
            userId: targetUid,
            title: data.subject,
            message: data.message.slice(0, 200) + (data.message.length > 200 ? "..." : ""),
            type: "announcement",
          });
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "email.broadcast_sent",
        targetType: "broadcast",
        details: {
          target: data.target,
          recipientsCount: recipients.length,
          subject: data.subject,
        },
      },
    });

    return {
      ok: true as const,
      recipientsCount: recipients.length,
      emailSent: emailResult.sent,
      message: `Broadcast message sent to ${recipients.length} recipient(s).`,
    };
  });

// 5. List Subscribers
export const listAdminSubscribers = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const profiles = await prisma.profile.findMany({ select: { email: true } });
    if (profiles.length > 0) {
      await prisma.newsletterSubscriber.createMany({
        data: profiles.map((p) => ({ email: p.email })),
        skipDuplicates: true,
      });
    }

    const list = await prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: "desc" },
    });

    return list.map((s) => ({
      id: s.id,
      email: s.email,
      created_at: s.createdAt.toISOString(),
    }));
  });

// 6. Delete Subscriber
export const deleteAdminSubscriber = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    await prisma.newsletterSubscriber.delete({ where: { id: data.id } });
    return { ok: true as const };
  });

// 7. Send Custom Email to User with Official Admin / Agent Signature
const customUserEmailSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().trim().min(3, "Subject / Title is required (min 3 characters)"),
  reason: z.string().trim().min(2, "Reason of the email is required"),
  body: z.string().trim().min(10, "Email message body is required (min 10 characters)"),
  sendInAppNotification: z.boolean().default(true),
  websiteUrl: z.string().trim().optional(),
});

export const sendAdminCustomUserEmail = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => customUserEmailSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId: actorId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const [targetUser, senderProfile, senderRoles, settings] = await Promise.all([
      prisma.profile.findUnique({
        where: { id: data.userId },
        select: { id: true, email: true, firstName: true, lastName: true },
      }),
      prisma.profile.findUnique({
        where: { id: actorId },
        select: { id: true, email: true, firstName: true, lastName: true },
      }),
      prisma.userRole.findMany({
        where: { userId: actorId },
        select: { role: true },
      }),
      prisma.businessSettings.findFirst({
        select: {
          businessName: true,
          smtpHost: true,
          smtpUser: true,
          smtpPass: true,
          smtpFromEmail: true,
        },
      }),
    ]);

    if (!targetUser) throw new Error("Target user profile was not found.");
    if (!senderProfile) throw new Error("Sender administrator profile was not found.");

    const host = settings?.smtpHost || process.env.SMTP_HOST;
    const user = settings?.smtpUser || process.env.SMTP_USER;
    const pass = settings?.smtpPass || process.env.SMTP_PASS;
    const fromEmail = settings?.smtpFromEmail || process.env.SMTP_FROM_EMAIL || settings?.smtpUser;
    const isConfigured = Boolean(host && user && pass && fromEmail);

    if (!isConfigured) {
      throw new Error(
        "SMTP email server is not configured. Please configure SMTP in Admin Business Settings first.",
      );
    }

    const isSuperAdmin = senderRoles.some((r) => r.role === "super_admin");
    const senderRoleTitle = isSuperAdmin
      ? "System Super Administrator"
      : "Authorized Staff Loan Officer";

    const senderFullName =
      `${senderProfile.firstName} ${senderProfile.lastName}`.trim() || senderProfile.email;
    const recipientFullName =
      `${targetUser.firstName} ${targetUser.lastName}`.trim() || targetUser.email;

    const { sendCustomUserEmailFromAdmin } = await import("./email.server");
    const result = await sendCustomUserEmailFromAdmin({
      recipientEmail: targetUser.email,
      recipientName: recipientFullName,
      title: data.title,
      reason: data.reason,
      bodyContent: data.body,
      senderName: senderFullName,
      senderEmail: senderProfile.email,
      senderRole: senderRoleTitle,
      websiteUrl: data.websiteUrl || (process.env.APP_URL ?? "/"),
      businessName: settings?.businessName || process.env.BUSINESS_NAME || "Lending Platform",
    });

    if (!result.sent) {
      throw new Error(
        result.error || result.reason || "Failed to deliver email through SMTP server.",
      );
    }

    if (data.sendInAppNotification) {
      const { createInAppNotification } = await import("./notifications.server");
      await createInAppNotification({
        userId: targetUser.id,
        title: data.title,
        message: `[${data.reason}] ${data.body.slice(0, 150)}${data.body.length > 150 ? "..." : ""}`,
        type: "announcement",
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId,
        action: "admin.custom_email_sent_to_user",
        targetType: "profile",
        targetId: targetUser.id,
        details: {
          recipientEmail: targetUser.email,
          title: data.title,
          reason: data.reason,
        },
      },
    });

    return {
      ok: true as const,
      message: `Email successfully delivered to ${targetUser.email}.`,
    };
  });
