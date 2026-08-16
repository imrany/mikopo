import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { fireCelebrationConfetti } from "@/lib/confetti";
import {
  getVapidPublicKeyFn,
  savePushSubscriptionFn,
  removePushSubscriptionFn,
  sendTestWebPushFn,
} from "@/lib/notifications.functions";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useWebPush() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check support & active subscription status
  const checkStatus = useCallback(async () => {
    try {
      if (
        typeof window === "undefined" ||
        !window.isSecureContext ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setIsSupported(false);
        return;
      }

      setIsSupported(true);
      setPermission(Notification.permission);

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.warn("[WebPush Status Check Notice]:", err);
      setIsSupported(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Subscribe to Web Push
  const subscribe = async () => {
    if (!isSupported) {
      toast.error("Web Push Notifications are not supported in this browser.");
      return false;
    }

    setLoading(true);
    try {
      // 1. Request notification permission if not granted
      let currentPermission = Notification.permission;
      if (currentPermission === "default") {
        currentPermission = await Notification.requestPermission();
        setPermission(currentPermission);
      }

      if (currentPermission !== "granted") {
        toast.error(
          "Notification permission was denied. Please allow notifications in browser settings.",
        );
        return false;
      }

      // 2. Register or ensure service worker is ready
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      }
      await navigator.serviceWorker.ready;

      // 3. Get Public VAPID Key from server
      const { publicKey } = await getVapidPublicKeyFn();
      if (!publicKey) {
        toast.error("VAPID Key not available on server.");
        return false;
      }

      // 4. Subscribe with PushManager
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      // 5. Extract keys and send to server
      const jsonSub = subscription.toJSON();
      const p256dh = jsonSub.keys?.p256dh;
      const auth = jsonSub.keys?.auth;

      if (!p256dh || !auth) {
        throw new Error("Push subscription keys missing.");
      }

      await savePushSubscriptionFn({
        data: {
          endpoint: subscription.endpoint,
          p256dh,
          auth,
        },
      });

      setIsSubscribed(true);
      fireCelebrationConfetti();
      toast.success("Web push notifications enabled successfully!");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[WebPush Subscribe Error]:", err);
      toast.error(`Failed to enable web push: ${message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Unsubscribe from Web Push
  const unsubscribe = async () => {
    if (!isSupported) return false;

    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await removePushSubscriptionFn({ data: { endpoint } });
      }

      setIsSubscribed(false);
      toast.info("Web push notifications disabled.");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[WebPush Unsubscribe Error]:", err);
      toast.error(`Failed to disable web push: ${message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Send Test Push
  const sendTestNotification = async () => {
    if (!isSubscribed) {
      toast.error("Please enable web push notifications first.");
      return;
    }

    setLoading(true);
    try {
      await sendTestWebPushFn();
      toast.success("Test web push notification triggered!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Test push failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe,
    sendTestNotification,
    checkStatus,
  };
}
