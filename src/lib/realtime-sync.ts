/**
 * Universal Real-time State Synchronization Hub
 *
 * Synchronizes application state seamlessly across components, routes, and
 * active browser tabs using BroadcastChannel, CustomEvents, and smart adaptive polling.
 */

export type RealtimeSyncTopic =
  | "LOAN_STATUS_CHANGED"
  | "PAYMENT_RECEIVED"
  | "CREDIBILITY_UPDATED"
  | "NOTIFICATION_RECEIVED"
  | "NOTIFICATION_READ"
  | "CONFIG_CHANGED"
  | "USER_PROFILE_UPDATED"
  | "GUARANTOR_UPDATED"
  | "REFERRAL_UPDATED"
  | "ALL";

export interface SyncMessage {
  topic: RealtimeSyncTopic;
  payload?: any;
  timestamp: number;
  originTabId: string;
}

const TAB_ID =
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `tab_${Math.random().toString(36).substring(2, 9)}`;

const CHANNEL_NAME = "mikopo_realtime_sync_channel";
const DOM_EVENT_NAME = "mikopo:realtime_sync";

let broadcastChannel: BroadcastChannel | null = null;

if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    broadcastChannel.onmessage = (event: MessageEvent<SyncMessage>) => {
      if (event.data && event.data.originTabId !== TAB_ID) {
        dispatchLocalEvent(event.data);
      }
    };
  } catch (e) {
    console.warn("[RealtimeSync] BroadcastChannel unavailable:", e);
  }
}

function dispatchLocalEvent(message: SyncMessage) {
  if (typeof window === "undefined") return;
  const customEvent = new CustomEvent<SyncMessage>(DOM_EVENT_NAME, {
    detail: message,
  });
  window.dispatchEvent(customEvent);
}

/**
 * Broadcasts a state change to all active components in the current tab
 * AND all other open tabs/devices.
 */
export function broadcastSync(topic: RealtimeSyncTopic, payload?: any) {
  const message: SyncMessage = {
    topic,
    payload,
    timestamp: Date.now(),
    originTabId: TAB_ID,
  };

  // 1. Dispatch locally in this tab
  dispatchLocalEvent(message);

  // 2. Broadcast to other tabs
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(message);
    } catch (e) {
      console.warn("[RealtimeSync] Broadcast postMessage error:", e);
    }
  }
}

/**
 * Subscribes to real-time sync events for specific topics.
 * Returns an unsubscribe function.
 */
export function subscribeToSync(
  topicOrTopics: RealtimeSyncTopic | RealtimeSyncTopic[],
  callback: (message: SyncMessage) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const topics = Array.isArray(topicOrTopics) ? topicOrTopics : [topicOrTopics];

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<SyncMessage>;
    if (!customEvent.detail) return;

    if (topics.includes("ALL") || topics.includes(customEvent.detail.topic)) {
      callback(customEvent.detail);
    }
  };

  window.addEventListener(DOM_EVENT_NAME, handler);
  return () => {
    window.removeEventListener(DOM_EVENT_NAME, handler);
  };
}
