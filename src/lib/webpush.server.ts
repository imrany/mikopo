import webpush from "web-push";
import { prisma } from "@/lib/prisma";

export async function getVapidConfig() {
  const settings = await prisma.businessSettings.findFirst({
    select: { id: true, vapidPublicKey: true, vapidPrivateKey: true, vapidSubject: true },
  });

  let publicKey = settings?.vapidPublicKey || process.env.VAPID_PUBLIC_KEY || "";
  let privateKey = settings?.vapidPrivateKey || process.env.VAPID_PRIVATE_KEY || "";
  const subject =
    settings?.vapidSubject ||
    (settings?.supportEmail ? `mailto:${settings.supportEmail}` : null) ||
    process.env.VAPID_SUBJECT ||
    "mailto:admin@example.com";

  if (!publicKey || !privateKey) {
    try {
      const generated = webpush.generateVAPIDKeys();
      publicKey = generated.publicKey;
      privateKey = generated.privateKey;

      if (settings) {
        await prisma.businessSettings.update({
          where: { id: settings.id },
          data: { vapidPublicKey: publicKey, vapidPrivateKey: privateKey, vapidSubject: subject },
        });
      }
    } catch (err) {
      console.error("[WebPush VAPID Key Generation Error]:", err);
    }
  }

  return { publicKey, privateKey, subject };
}

export async function getPublicVapidKey(): Promise<string> {
  const config = await getVapidConfig();
  return config.publicKey;
}

export function generateNewVapidKeys() {
  return webpush.generateVAPIDKeys();
}

export interface WebPushPayload {
  title: string;
  message: string;
  url?: string;
  icon?: string;
  type?: string;
}

/**
 * Dispatch Web Push Notification to specified target users or roles
 */
export async function sendWebPushNotification({
  userId,
  roleTarget,
  title,
  message,
  url = "/notifications",
}: {
  userId?: string | null;
  roleTarget?: "admin" | "all" | "user" | null;
  title: string;
  message: string;
  url?: string;
}) {
  try {
    const config = await getVapidConfig();

    if (!config.publicKey || !config.privateKey) {
      return;
    }

    try {
      webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    } catch (err) {
      console.error("[WebPush setVapidDetails Error]:", err);
      return;
    }

    let subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[] = [];

    if (userId) {
      subscriptions = await prisma.pushSubscription.findMany({
        where: { userId },
      });
    } else if (roleTarget === "admin") {
      const adminRoles = await prisma.userRole.findMany({
        where: { role: { in: ["super_admin", "staff"] } },
        select: { userId: true },
      });
      const adminUserIds = adminRoles.map((r) => r.userId);

      subscriptions = await prisma.pushSubscription.findMany({
        where: { userId: { in: adminUserIds } },
      });
    } else if (roleTarget === "all") {
      subscriptions = await prisma.pushSubscription.findMany();
    }

    if (subscriptions.length === 0) {
      return;
    }

    const payloadString = JSON.stringify({
      title,
      message,
      body: message,
      url,
      icon: "/pwa-icon.png",
      badge: "/pwa-icon.png",
      tag: `mikopo-${Date.now()}`,
    });

    const sendPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, payloadString);
      } catch (err: unknown) {
        const error = err as { statusCode?: number; message?: string };
        if (error?.statusCode === 410 || error?.statusCode === 404) {
          try {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
          } catch {
            // Ignore delete error if already removed
          }
        } else {
          console.error(
            `[WebPush Send Error for ${sub.endpoint.slice(0, 30)}...]:`,
            error?.message || err,
          );
        }
      }
    });

    await Promise.allSettled(sendPromises);
  } catch (err) {
    console.error("[sendWebPushNotification Error]:", err);
  }
}
