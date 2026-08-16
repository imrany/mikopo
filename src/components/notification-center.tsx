import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bell,
  BellRing,
  BellOff,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  Eye,
  Info,
  LucideLoader,
  Send,
  ShieldAlert,
  Sparkles,
  Volume2,
  VolumeX,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  getUnreadNotificationCount,
  listMyNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/notifications.functions";
import { NotificationItem } from "@/components/notification-detail-sheet";
import {
  isNotificationSoundMuted,
  playNotificationSound,
  setNotificationSoundMuted,
} from "@/lib/sound";
import { useWebPush } from "@/hooks/use-web-push";
import { useAppConfig } from "@/lib/config-context";
import { useUrlBooleanState, useUrlStringState } from "@/lib/use-url-search-state";
import { AnimatePresence, motion } from "framer-motion";

export function NotificationBell() {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useUrlBooleanState("notifications");
  const [selectedNotificationId, setSelectedNotificationId] = useUrlStringState("notificationId");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const isInitialLoad = useRef(true);
  const lastCountRef = useRef<number | null>(null);
  const { businessName } = useAppConfig();

  const selectedNotification = notifications.find((n) => n.id === selectedNotificationId) || null;

  const {
    isSupported: isPushSupported,
    isSubscribed: isPushSubscribed,
    loading: pushLoading,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    sendTestNotification: sendTestPush,
  } = useWebPush();

  useEffect(() => {
    setIsMuted(isNotificationSoundMuted());
  }, []);

  async function refreshCount() {
    try {
      const res = await getUnreadNotificationCount();
      const current = res.unreadCount;

      if (
        lastCountRef.current !== null &&
        current > lastCountRef.current &&
        !isInitialLoad.current
      ) {
        // Play notification chime when new notification arrives
        playNotificationSound();

        // Also trigger native browser notification if granted
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification(`${businessName} Notification`, {
              body: `You have ${current} unread notification${current > 1 ? "s" : ""}.`,
              icon: "/pwa-icon.png",
              tag: `${businessName}-unread-alert`,
            });
          } catch {
            // ignore
          }
        }
      }

      lastCountRef.current = current;
      setUnreadCount(current);
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
      }
    } catch {
      // ignore
    }
  }

  async function loadNotifications() {
    setLoading(true);
    try {
      const list = await listMyNotifications();
      setNotifications(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen || Boolean(selectedNotificationId)) {
      loadNotifications();
    }
  }, [isOpen, selectedNotificationId]);

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 12000); // Poll for new notifications every 12s
    return () => clearInterval(interval);
  }, []);

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) {
      setSelectedNotificationId(null);
    } else {
      loadNotifications();
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await markNotificationAsRead({ data: { notificationId: id } });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }

  async function handleOpenNotificationLink(notification: NotificationItem) {
    if (!notification.isRead) {
      await handleMarkRead(notification.id);
    }
    if (notification.link) {
      setIsOpen(false);
      setSelectedNotificationId(null);
      navigate({ to: notification.link as string });
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case "loan_requested":
      case "loan_approved":
      case "loan_disbursed":
        return <Wallet className="h-4 w-4 text-primary" />;
      case "repayment_received":
        return <Check className="h-4 w-4 text-primary" />;
      case "due_reminder":
      case "loan_rejected":
        return <ShieldAlert className="h-4 w-4 text-destructive" />;
      case "announcement":
        return <Sparkles className="h-4 w-4 text-primary" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  }

  function getTypeBadge(type: string) {
    switch (type) {
      case "loan_requested":
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px]"
          >
            <Wallet className="size-3" /> Loan Request
          </Badge>
        );
      case "loan_approved":
      case "loan_disbursed":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px]"
          >
            <Check className="size-3" /> Approved & Disbursed
          </Badge>
        );
      case "repayment_received":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px]"
          >
            <CheckCheck className="size-3" /> Payment Received
          </Badge>
        );
      case "due_reminder":
      case "loan_rejected":
        return (
          <Badge
            variant="outline"
            className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 gap-1 text-[11px]"
          >
            <ShieldAlert className="size-3" /> Action Required
          </Badge>
        );
      case "announcement":
      case "tier_update":
        return (
          <Badge
            variant="outline"
            className="bg-primary/10 text-primary border-primary/30 gap-1 text-[11px]"
          >
            <Sparkles className="size-3" /> Announcement
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="bg-muted text-muted-foreground border-border gap-1 text-[11px]"
          >
            <Info className="size-3" /> System Update
          </Badge>
        );
    }
  }

  // Panel is open if either ?notifications=open or ?notificationId=... is set
  const sheetOpen = isOpen || Boolean(selectedNotificationId);

  return (
    <Sheet open={sheetOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white shadow-xs">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-md flex flex-col p-0 overflow-hidden">
        <AnimatePresence initial={false} mode="wait">
          {selectedNotification ? (
            /* DETAIL VIEW */
            <motion.div
              key="detail-view"
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 28 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="flex flex-col h-full overflow-hidden"
            >
              <SheetHeader className="p-5 sm:p-6 border-b border-border/60 pb-4 text-left">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedNotificationId(null)}
                    className="-ml-2 h-8 px-2.5 text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to notifications
                  </Button>
                  <div className="flex items-center gap-1.5">
                    {getTypeBadge(selectedNotification.type)}
                    {!selectedNotification.isRead && (
                      <Badge variant="default" className="text-[10px] uppercase tracking-wider h-5">
                        Unread
                      </Badge>
                    )}
                  </div>
                </div>

                <SheetTitle className="text-base sm:text-lg font-bold text-foreground leading-snug">
                  {selectedNotification.title}
                </SheetTitle>

                <SheetDescription className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                  <Clock className="size-3.5" />
                  {new Date(selectedNotification.createdAt).toLocaleDateString("en-KE", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                <div className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Message Content
                  </h4>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {selectedNotification.message}
                  </p>
                </div>

                {selectedNotification.link && (
                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                      Associated Page / Action
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      This alert includes a direct action shortcut to visit{" "}
                      <code className="font-mono bg-background px-1.5 py-0.5 rounded border border-border/60 text-foreground">
                        {selectedNotification.link}
                      </code>
                    </p>
                  </div>
                )}
              </div>

              <SheetFooter className="mt-auto p-4 sm:p-5 border-t border-border/60 gap-2 sm:gap-2 flex-row">
                <Button
                  variant="outline"
                  onClick={() => setSelectedNotificationId(null)}
                  className="flex-1 text-xs h-9"
                >
                  <ArrowLeft className="size-3.5 mr-1" /> Notifications
                </Button>

                {selectedNotification.link && (
                  <Button
                    variant="gold"
                    onClick={() => handleOpenNotificationLink(selectedNotification)}
                    className="flex-1 text-xs h-9"
                  >
                    Go to Page <ExternalLink className="size-3.5 ml-1" />
                  </Button>
                )}
              </SheetFooter>
            </motion.div>
          ) : (
            /* LIST VIEW */
            <motion.div
              key="list-view"
              initial={{ opacity: 0, x: -28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -28 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="flex flex-col h-full overflow-hidden"
            >
              <SheetHeader className="p-5 sm:p-6 border-b border-border/60 pb-4 text-left">
                <div className="flex items-center justify-between">
                  <SheetTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                    <Bell className="h-5 w-5 text-primary" />
                    Notifications
                  </SheetTitle>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      onClick={() => {
                        const nextMuted = !isMuted;
                        setIsMuted(nextMuted);
                        setNotificationSoundMuted(nextMuted);
                        if (!nextMuted) {
                          playNotificationSound();
                        }
                      }}
                      title={
                        isMuted
                          ? "Sound alerts muted. Click to enable sound."
                          : "Sound alerts active. Click to mute sound."
                      }
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      {isMuted ? (
                        <VolumeX className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Volume2 className="h-4 w-4 text-primary" />
                      )}
                    </Button>
                    {unreadCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMarkAllRead}
                        className="text-xs gap-1 text-muted-foreground h-8"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark all read
                      </Button>
                    )}
                  </div>
                </div>
                <SheetDescription className="flex items-center justify-between text-xs">
                  <span>Activity updates, loan reminders, and administrative announcements.</span>
                </SheetDescription>

                {/* Web Push Banner Control */}
                {isPushSupported && (
                  <div className="mt-3 p-3 rounded-xl bg-muted/50 border border-border/80 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-1.5 rounded-lg ${isPushSubscribed ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
                      >
                        {isPushSubscribed ? (
                          <BellRing className="h-4 w-4" />
                        ) : (
                          <BellOff className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          Web Push
                          {isPushSubscribed ? (
                            <Badge className="bg-primary text-primary-foreground text-[10px] h-4 px-1.5">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                              Off
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {isPushSubscribed
                            ? "Browser push alerts enabled"
                            : "Receive instant device alerts"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isPushSubscribed ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={sendTestPush}
                            disabled={pushLoading}
                            className="h-7 px-2 text-[11px] gap-1 text-primary"
                            title="Send test push notification to this device"
                          >
                            <Send className="h-3 w-3" /> Test
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={unsubscribePush}
                            disabled={pushLoading}
                            className="h-7 px-2 text-[11px]"
                          >
                            Disable
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={subscribePush}
                          disabled={pushLoading}
                          className="h-7 px-2.5 text-[11px] font-medium gap-1"
                        >
                          <BellRing className="h-3 w-3" /> Enable Push
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {loading ? (
                  <div className="p-8 text-center">
                    <LucideLoader className="mx-auto text-muted-foreground animate-spin text-sm" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground space-y-2">
                    <Bell className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                    <p>You have no notifications yet.</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        setSelectedNotificationId(n.id);
                        if (!n.isRead) handleMarkRead(n.id);
                      }}
                      className={`p-3.5 rounded-xl border transition-all text-sm relative cursor-pointer hover:border-primary/50 ${
                        n.isRead
                          ? "bg-card border-border/60 text-card-foreground"
                          : "bg-primary/5 border-primary/20 text-foreground shadow-xs"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted shrink-0 mt-0.5">
                          {getTypeIcon(n.type)}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-foreground text-xs sm:text-sm">
                              {n.title}
                            </h4>
                            {!n.isRead && (
                              <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                            {n.message}
                          </p>
                          <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(n.createdAt).toLocaleDateString("en-KE", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedNotificationId(n.id);
                                  if (!n.isRead) handleMarkRead(n.id);
                                }}
                                className="text-primary font-semibold hover:underline flex items-center gap-1"
                              >
                                <Eye className="size-3" /> View
                              </button>
                              {!n.isRead && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkRead(n.id);
                                  }}
                                  className="text-muted-foreground hover:text-foreground underline"
                                >
                                  Mark read
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-muted/30 text-center border-t border-border/50">
                <Link
                  to="/notifications"
                  onClick={() => setIsOpen(false)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View full notification history
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
