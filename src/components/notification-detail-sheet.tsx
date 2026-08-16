import { useNavigate } from "@tanstack/react-router";
import {
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  Info,
  ShieldAlert,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { markNotificationAsRead } from "@/lib/notifications.functions";

export type NotificationItem = {
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

interface NotificationDetailSheetProps {
  notification: NotificationItem | null;
  onClose: () => void;
  onMarkRead?: (id: string) => void;
}

export function NotificationDetailSheet({
  notification,
  onClose,
  onMarkRead,
}: NotificationDetailSheetProps) {
  const navigate = useNavigate();

  if (!notification) return null;

  async function handleOpenLink() {
    if (!notification) return;
    if (!notification.isRead) {
      try {
        await markNotificationAsRead({ data: { notificationId: notification.id } });
        onMarkRead?.(notification.id);
      } catch {
        // ignore
      }
    }
    if (notification.link) {
      onClose();
      navigate({ to: notification.link as string });
    }
  }

  function getTypeBadge(type: string) {
    switch (type) {
      case "loan_requested":
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1"
          >
            <Wallet className="size-3" /> Loan Request
          </Badge>
        );
      case "loan_approved":
      case "loan_disbursed":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1"
          >
            <Check className="size-3" /> Approved & Disbursed
          </Badge>
        );
      case "repayment_received":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1"
          >
            <CheckCheck className="size-3" /> Payment Received
          </Badge>
        );
      case "due_reminder":
      case "loan_rejected":
        return (
          <Badge
            variant="outline"
            className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 gap-1"
          >
            <ShieldAlert className="size-3" /> Action Required / Reminder
          </Badge>
        );
      case "announcement":
      case "tier_update":
        return (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 gap-1">
            <Sparkles className="size-3" /> Announcement
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1">
            <Info className="size-3" /> System Update
          </Badge>
        );
    }
  }

  return (
    <Sheet open={Boolean(notification)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-6 overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-2 mb-1">
            {getTypeBadge(notification.type)}
            {!notification.isRead && (
              <Badge variant="default" className="text-[10px] uppercase tracking-wider">
                Unread
              </Badge>
            )}
          </div>
          <SheetTitle className="text-lg font-bold text-foreground leading-snug">
            {notification.title}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
            <Clock className="size-3.5" />
            {new Date(notification.createdAt).toLocaleDateString("en-KE", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 flex-1 space-y-6">
          <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Message Content
            </h4>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {notification.message}
            </p>
          </div>

          {notification.link && (
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Associated Page / Action
              </h4>
              <p className="text-xs text-muted-foreground">
                This alert includes a direct action shortcut to visit{" "}
                <code className="font-mono bg-background px-1.5 py-0.5 rounded border text-foreground">
                  {notification.link}
                </code>
              </p>
            </div>
          )}
        </div>

        <SheetFooter className="mt-auto pt-4 border-t gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            <X className="size-4 mr-1" /> Close
          </Button>

          {notification.link && (
            <Button variant="gold" onClick={handleOpenLink} className="flex-1">
              Go to Page <ExternalLink className="size-4 ml-1" />
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
