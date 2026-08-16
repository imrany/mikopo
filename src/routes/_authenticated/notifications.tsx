import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, CheckCheck, Clock, Eye, Volume2, VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listMyNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/notifications.functions";
import { NotificationDetailSheet } from "@/components/notification-detail-sheet";
import { playNotificationSound, setNotificationSoundMuted } from "@/lib/sound";
import BackButton from "@/components/back-button";
import { useUrlStringState } from "@/lib/use-url-search-state";

export const Route = createFileRoute("/_authenticated/notifications")({
  validateSearch: (search: Record<string, unknown>) => search,
  component: NotificationsPage,
});

type NotificationItem = {
  id: string;
  userId: string | null;
  roleTarget: string | null;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
};

function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotificationId, setSelectedNotificationId] = useUrlStringState("notificationId");
  const [filter, setFilter] = useState<"all" | "unread" | "loans" | "announcements">("all");
  const [isMuted, setIsMuted] = useState(false);

  const selectedNotification = notifications.find((n) => n.id === selectedNotificationId) || null;

  async function loadData() {
    setLoading(true);
    try {
      const data = await listMyNotifications();
      setNotifications(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleMarkRead(id: string) {
    try {
      await markNotificationAsRead({ data: { notificationId: id } });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  }

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    if (filter === "loans")
      return [
        "loan_requested",
        "loan_approved",
        "loan_disbursed",
        "loan_rejected",
        "repayment_received",
        "due_reminder",
      ].includes(n.type);
    if (filter === "announcements") return n.type === "announcement" || n.type === "tier_update";
    return true;
  });

  const unreadTotal = notifications.filter((n) => !n.isRead).length;

  function getTypeBadge(type: string) {
    switch (type) {
      case "loan_requested":
        return (
          <Badge variant="outline" className="bg-gold/10 text-gold border-gold/30">
            Loan Request
          </Badge>
        );
      case "loan_approved":
      case "loan_disbursed":
        return (
          <Badge
            variant="outline"
            className="bg-primary/10 text-primary-foreground border-primary/30"
          >
            Approved & Disbursed
          </Badge>
        );
      case "repayment_received":
        return (
          <Badge
            variant="outline"
            className="bg-primary/10 text-primary-foreground border-primary/30"
          >
            Payment Received
          </Badge>
        );
      case "due_reminder":
        return (
          <Badge
            variant="outline"
            className="bg-destructive/10 text-destructive-foreground border-destructive/30"
          >
            Due Reminder
          </Badge>
        );
      case "announcement":
        return (
          <Badge variant="outline" className="bg-gold/10 text-gold-foreground border-gold/30">
            Announcement
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
            System Alert
          </Badge>
        );
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 space-y-8">
        <BackButton label="Back to previous page" size="sm" className="-ml-2 mb-2" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" />
              Notification Center
            </h1>
            <p className="text-sm text-muted-foreground">
              Stay up to date with your loan activities, payment reminders, and company updates.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              onClick={() => {
                const nextMuted = !isMuted;
                setIsMuted(nextMuted);
                setNotificationSoundMuted(nextMuted);
                if (!nextMuted) {
                  playNotificationSound();
                }
              }}
              className="gap-2"
              title={
                isMuted
                  ? "Sound alerts muted. Click to enable sound."
                  : "Sound alerts active. Click to mute sound."
              }
            >
              {isMuted ? (
                <>
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                  <span>Sound Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 text-primary" />
                  <span>Sound Alert Active</span>
                </>
              )}
            </Button>

            {unreadTotal > 0 && (
              <Button variant="outline" onClick={handleMarkAllRead} className="gap-2">
                <CheckCheck className="h-4 w-4 text-primary" />
                Mark all ({unreadTotal}) as read
              </Button>
            )}
          </div>
        </div>

        <Card className="border-border/80 shadow-soft">
          <CardHeader className="pb-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Activity Feed</CardTitle>
              <CardDescription>Filter and view all notifications in real-time</CardDescription>
            </div>
            <Tabs
              value={filter}
              onValueChange={(val) => setFilter(val as typeof filter)}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid grid-cols-4 w-full sm:w-auto text-xs">
                <TabsTrigger value="all">All ({notifications.length})</TabsTrigger>
                <TabsTrigger value="unread">Unread ({unreadTotal})</TabsTrigger>
                <TabsTrigger value="loans">Loans</TabsTrigger>
                <TabsTrigger value="announcements">Updates</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Loading notifications...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground space-y-3">
                <Bell className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-medium">No notifications found for this view.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      setSelectedNotificationId(n.id);
                      if (!n.isRead) handleMarkRead(n.id);
                    }}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 cursor-pointer hover:border-primary/50 ${
                      n.isRead
                        ? "bg-card border-border/60"
                        : "bg-primary/5 border-primary/20 shadow-xs"
                    }`}
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getTypeBadge(n.type)}
                        <h3 className="font-semibold text-foreground text-sm">{n.title}</h3>
                        {!n.isRead && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                            NEW
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pt-1 line-clamp-2">
                        {n.message}
                      </p>
                      <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {new Date(n.createdAt).toLocaleDateString("en-KE", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <Button
                        variant="gold"
                        size="sm"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNotificationId(n.id);
                          if (!n.isRead) handleMarkRead(n.id);
                        }}
                        className="text-xs h-8 gap-1"
                      >
                        <Eye className="size-3.5" /> View Details
                      </Button>
                      {!n.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkRead(n.id);
                          }}
                          className="text-xs h-8 text-muted-foreground hover:text-foreground"
                        >
                          Mark read
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <NotificationDetailSheet
        notification={selectedNotification}
        onClose={() => setSelectedNotificationId(null)}
        onMarkRead={(id) => {
          setNotifications((prev) =>
            prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
          );
        }}
      />
    </div>
  );
}
