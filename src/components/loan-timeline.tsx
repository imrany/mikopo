import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { LucideAlertTriangle, LucideRefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLoanTimeline } from "@/lib/loans.functions";

const listVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

interface LoanTimelineEvent {
  id: string;
  status: string;
  previous_status: string | null;
  actor_name: string | null;
  actor_role: string | null;
  note: string | null;
  created_at: string;
}

// Badge fills — translucent, meant for text-on-pill contexts.
const STATUS_BADGE_COLOR: Record<string, string> = {
  pending_guarantors: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/40",
  pending_approval: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/40",
  approved: "bg-sky-500/15 text-sky-800 dark:text-sky-200 border-sky-500/40",
  disbursing: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-200 border-indigo-500/40",
  active:
    "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/40 font-semibold",
  repaid: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/40",
  rejected: "bg-rose-500/15 text-rose-800 dark:text-rose-200 border-rose-500/40",
  defaulted: "bg-gray-500/15 text-gray-800 dark:text-gray-200 border-gray-500/40",
};

// Solid fills for the small timeline dots — need to actually be visible at 12px.
const STATUS_DOT_COLOR: Record<string, string> = {
  pending_guarantors: "bg-amber-500",
  pending_approval: "bg-amber-500",
  approved: "bg-sky-500",
  disbursing: "bg-indigo-500",
  active: "bg-emerald-500",
  repaid: "bg-emerald-500",
  rejected: "bg-rose-500",
  defaulted: "bg-gray-500",
};

const STATUS_LABEL: Record<string, string> = {
  pending_guarantors: "Awaiting Guarantors",
  pending_approval: "Awaiting Admin Approval",
  approved: "Approved (Pending Payout)",
  disbursing: "Disbursing via M-Pesa",
  active: "Active Loan",
  repaid: "Fully Repaid",
  rejected: "Rejected",
  defaulted: "Defaulted",
};

function TimelineSkeleton() {
  return (
    <div className="space-y-3 py-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-3 animate-pulse">
          <div className="mt-1 size-3 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-2.5 w-20 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoanTimeline({ loanId }: { loanId: string }) {
  const timelineFn = useServerFn(getLoanTimeline);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["loan-timeline", loanId],
    queryFn: () => timelineFn({ data: { loanId } }) as Promise<LoanTimelineEvent[]>,
  });

  const events = data ?? [];
  // Assumes events are ordered oldest -> newest; the last entry is the current status.
  const currentEventId = events[events.length - 1]?.id;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {isLoading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <span className="sr-only">Loading loan timeline…</span>
          <TimelineSkeleton />
        </motion.div>
      ) : isError ? (
        <motion.div
          key="error"
          role="alert"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex flex-col items-start gap-2 text-xs text-muted-foreground py-2"
        >
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <LucideAlertTriangle className="size-4" aria-hidden="true" />
            <span>Couldn't load the loan timeline.</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <LucideRefreshCw className={isFetching ? "size-3 animate-spin" : "size-3"} />
            {isFetching ? "Retrying…" : "Retry"}
          </Button>
        </motion.div>
      ) : events.length === 0 ? (
        <motion.p
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="text-xs text-muted-foreground"
        >
          No timeline events recorded yet.
        </motion.p>
      ) : (
        <motion.ol
          key="list"
          initial="hidden"
          animate="visible"
          variants={listVariants}
          className="relative ml-2 space-y-3 border-l border-border pl-5 text-xs"
        >
          {events.map((event) => {
            const isCurrent = event.id === currentEventId;
            const dotColor = STATUS_DOT_COLOR[event.status] ?? "bg-muted-foreground";
            const badgeColor =
              STATUS_BADGE_COLOR[event.status] ?? "bg-muted text-foreground border-border";
            const label = STATUS_LABEL[event.status] ?? event.status;
            const date = new Date(event.created_at);
            const formattedDate = date.toLocaleString("en-KE", {
              dateStyle: "medium",
              timeStyle: "short",
            });

            return (
              <motion.li key={event.id} variants={itemVariants as any} className="relative">
                <span
                  aria-hidden="true"
                  className={`absolute left-[-1.65rem] top-1 flex size-3 items-center justify-center rounded-full ring-2 ring-background ${dotColor} ${
                    isCurrent
                      ? "ring-2 ring-offset-1 ring-offset-background ring-foreground/30"
                      : ""
                  }`}
                >
                  {isCurrent && (
                    <motion.span
                      className={`absolute inset-0 rounded-full ${dotColor}`}
                      animate={{ scale: [1, 1.9, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  )}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`text-[11px] px-2 py-0.5 ${badgeColor}`}>
                    {label}
                  </Badge>
                  {isCurrent && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-foreground text-background">
                      Current
                    </Badge>
                  )}
                  {event.previous_status && (
                    <span className="text-[11px] text-muted-foreground">
                      (from {STATUS_LABEL[event.previous_status] ?? event.previous_status})
                    </span>
                  )}
                  {event.actor_name && (
                    <span className="text-[10px] font-medium text-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                      By: {event.actor_name}{" "}
                      {event.actor_role ? `(${event.actor_role.replace(/_/g, " ")})` : ""}
                    </span>
                  )}
                </div>
                {event.note && (
                  <p className="mt-1 text-[11px] text-foreground/90 leading-relaxed font-normal">
                    {event.note}
                  </p>
                )}
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  <time dateTime={date.toISOString()}>{formattedDate}</time>
                </p>
              </motion.li>
            );
          })}
        </motion.ol>
      )}
    </AnimatePresence>
  );
}
