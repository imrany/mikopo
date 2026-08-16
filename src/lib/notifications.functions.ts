import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireCustomAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";

async function canReceiveSystemAlerts(userId: string, roles: string[]): Promise<boolean> {
  if (roles.includes("super_admin")) return true;
  if (!roles.includes("staff")) return false;

  const staffRole = await prisma.userRole.findFirst({
    where: { userId, role: "staff" },
    select: { permissions: true },
  });

  return Boolean(
    staffRole &&
    Array.isArray(staffRole.permissions) &&
    (staffRole.permissions.includes("receive_system_alerts") ||
      staffRole.permissions.includes("handle_user_requests") ||
      staffRole.permissions.includes("manage_support")),
  );
}

// 1. List In-App Notifications
export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { userId, roles } = context;
    const canReceiveAlerts = await canReceiveSystemAlerts(userId, roles);

    const targets: (string | null)[] = ["all"];
    if (canReceiveAlerts) targets.push("admin");

    const notifications = await prisma.notification.findMany({
      where: {
        OR: [{ userId }, { roleTarget: { in: targets as string[] } }],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return notifications.map((n: any) => ({
      id: n.id,
      userId: n.userId,
      roleTarget: n.roleTarget,
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: n.isRead,
      link: n.link,
      createdAt: n.createdAt.toISOString(),
    }));
  });

// 2. Mark Single Notification as Read
export const markNotificationAsRead = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ notificationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    const canReceiveAlerts = await canReceiveSystemAlerts(userId, roles);

    const notif = await prisma.notification.findUnique({
      where: { id: data.notificationId },
    });

    if (!notif) throw new Error("Notification not found");
    if (notif.roleTarget === "admin" && !canReceiveAlerts) {
      throw new Error("Forbidden: You are not authorized to view system alerts.");
    }
    if (notif.userId && notif.userId !== userId && !roles.includes("super_admin")) {
      throw new Error("Forbidden");
    }

    await prisma.notification.update({
      where: { id: data.notificationId },
      data: { isRead: true },
    });

    return { ok: true as const };
  });

// 3. Mark All Notifications as Read
export const markAllNotificationsAsRead = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { userId, roles } = context;
    const canReceiveAlerts = await canReceiveSystemAlerts(userId, roles);

    const targets: (string | null)[] = ["all"];
    if (canReceiveAlerts) targets.push("admin");

    await prisma.notification.updateMany({
      where: {
        OR: [{ userId }, { roleTarget: { in: targets as string[] } }],
        isRead: false,
      },
      data: { isRead: true },
    });

    return { ok: true as const };
  });

// 4. Get Unread Count
export const getUnreadNotificationCount = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { userId, roles } = context;
    const canReceiveAlerts = await canReceiveSystemAlerts(userId, roles);

    const targets: (string | null)[] = ["all"];
    if (canReceiveAlerts) targets.push("admin");

    const count = await prisma.notification.count({
      where: {
        OR: [{ userId }, { roleTarget: { in: targets as string[] } }],
        isRead: false,
      },
    });

    return { unreadCount: count };
  });

// 5. Public Newsletter Subscription
export const subscribeNewsletter = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ email: z.string().email("Valid email required") }).parse(input),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim();

    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
    if (existing) {
      return { ok: true as const, message: "You are already subscribed to updates." };
    }

    await prisma.newsletterSubscriber.create({
      data: { email },
    });

    return { ok: true as const, message: "Thank you for subscribing to updates!" };
  });

// 6. Admin Manual Trigger for Due Date Reminders
export const triggerDueRemindersNow = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const { scanAndSendDueReminders } = await import("./notifications.server");
    const result = await scanAndSendDueReminders();

    return { ok: true as const, ...result };
  });

// 7. Get Public VAPID Key
export const getVapidPublicKeyFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicVapidKey } = await import("./webpush.server");
  const publicKey = await getPublicVapidKey();
  return { publicKey };
});

// 7b. Get Admin VAPID Settings
export const getAdminVapidSettingsFn = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const { getVapidConfig } = await import("./webpush.server");
    const config = await getVapidConfig();
    const totalSubscriptions = await prisma.pushSubscription.count();

    return {
      publicKey: config.publicKey,
      privateKey: config.privateKey,
      subject: config.subject,
      totalSubscriptions,
    };
  });

// 7c. Save Admin VAPID Settings
const saveVapidSchema = z.object({
  publicKey: z.string().trim().min(1, "Public key is required"),
  privateKey: z.string().trim().min(1, "Private key is required"),
  subject: z.string().trim().min(1, "Subject (e.g. mailto:...) is required"),
});

export const saveAdminVapidSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => saveVapidSchema.parse(input))
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
          vapidPublicKey: data.publicKey,
          vapidPrivateKey: data.privateKey,
          vapidSubject: data.subject,
        },
      });
    } else {
      await prisma.businessSettings.create({
        data: {
          businessName: process.env["BUSINESS_NAME"] || "Lending Platform",
          businessLocation: "Nairobi, Kenya",
          vapidPublicKey: data.publicKey,
          vapidPrivateKey: data.privateKey,
          vapidSubject: data.subject,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "webpush.vapid_updated",
        targetType: "business_settings",
      },
    });

    return { ok: true as const, message: "VAPID keys and push configuration saved successfully." };
  });

// 7d. Auto-Generate New VAPID Key Pair for Admin
export const generateAdminVapidKeysFn = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const { generateNewVapidKeys } = await import("./webpush.server");
    const newKeys = generateNewVapidKeys();

    const settings = await prisma.businessSettings.findFirst();
    if (settings) {
      await prisma.businessSettings.update({
        where: { id: settings.id },
        data: {
          vapidPublicKey: newKeys.publicKey,
          vapidPrivateKey: newKeys.privateKey,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "webpush.vapid_generated",
        targetType: "business_settings",
      },
    });

    return {
      ok: true as const,
      publicKey: newKeys.publicKey,
      privateKey: newKeys.privateKey,
      message: "Generated new VAPID keypair and updated settings successfully.",
    };
  });

// 8. Save Web Push Subscription
export const savePushSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) =>
    z
      .object({
        endpoint: z.string().url(),
        p256dh: z.string().min(1),
        auth: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    await prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      create: {
        userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
      },
      update: {
        userId,
        p256dh: data.p256dh,
        auth: data.auth,
      },
    });

    return { ok: true as const };
  });

// 9. Remove Web Push Subscription
export const removePushSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) =>
    z
      .object({
        endpoint: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    await prisma.pushSubscription.deleteMany({
      where: {
        endpoint: data.endpoint,
        userId,
      },
    });

    return { ok: true as const };
  });

// 10. Send Test Web Push Notification
export const sendTestWebPushFn = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { sendWebPushNotification } = await import("./webpush.server");

    await sendWebPushNotification({
      userId,
      title: "Test Web Push Notification",
      message: "Web push notifications are working perfectly on your device!",
      url: "/notifications",
    });

    return { ok: true as const };
  });
