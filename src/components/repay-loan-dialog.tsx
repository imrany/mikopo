import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Clock,
  LucideLoader,
  Phone,
  Wallet,
  AlertCircle,
  MoreHorizontal,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { formatKes } from "@/lib/format";
import { startRepayment } from "@/lib/loans.functions";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useUrlStringState } from "@/lib/use-url-search-state";

export interface RepayLoanDialogProps {
  loan: {
    id: string;
    principal: number;
    total_due: number;
    amount_repaid: number;
    penalty_amount?: number;
    penalty_count?: number;
    status?: string;
    interest_amount?: number;
    due_date?: string | null;
    disbursement_phone?: string | null;
    loan_products?: { name: string; term_days?: number } | null;
  };
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function computeLoanDueDateInfo(
  dueDateStr?: string | null,
  now = new Date(),
  isRepaid = false,
): {
  daysText: string;
  detailedTimeText: string;
  fullDeadlineText: string;
  isOverdue: boolean;
  isDueToday: boolean;
  badgeClass: string;
} {
  if (isRepaid) {
    return {
      daysText: "Fully Repaid",
      detailedTimeText: "Loan Fully Repaid",
      fullDeadlineText: "Fully Repaid",
      isOverdue: false,
      isDueToday: false,
      badgeClass:
        "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
    };
  }

  if (!dueDateStr) {
    return {
      daysText: "Awaiting disbursement",
      detailedTimeText: "Starts upon disbursement",
      fullDeadlineText: "—",
      isOverdue: false,
      isDueToday: false,
      badgeClass: "bg-muted text-muted-foreground",
    };
  }

  const due = new Date(dueDateStr);
  const diffMs = due.getTime() - now.getTime();

  const fullDeadlineText = due.toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (diffMs > 0) {
    const totalSecs = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    let daysText = "";
    if (days > 0) {
      daysText = `${days}d ${hours}h ${mins}m ${secs}s remaining`;
    } else if (hours > 0) {
      daysText = `${hours}h ${mins}m ${secs}s remaining`;
    } else {
      daysText = `${mins}m ${secs}s remaining`;
    }

    const detailedTimeText = `${days}d ${hours}h ${mins}m ${secs}s left`;
    const isDueToday = days === 0;

    return {
      daysText,
      detailedTimeText,
      fullDeadlineText,
      isOverdue: false,
      isDueToday,
      badgeClass: isDueToday
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
        : "bg-primary/10 text-primary border border-primary/20",
    };
  } else {
    const overdueMs = Math.abs(diffMs);
    const totalSecs = Math.floor(overdueMs / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    let overdueString = "";
    if (days > 0) {
      overdueString = `${days}d ${hours}h ${mins}m ${secs}s overdue`;
    } else if (hours > 0) {
      overdueString = `${hours}h ${mins}m ${secs}s overdue`;
    } else {
      overdueString = `${mins}m ${secs}s overdue`;
    }

    return {
      daysText: overdueString,
      detailedTimeText: `${days}d ${hours}h ${mins}m overdue`,
      fullDeadlineText,
      isOverdue: true,
      isDueToday: false,
      badgeClass: "bg-destructive/15 text-destructive border border-destructive/30",
    };
  }
}

export function useRealtimeDeadline(
  dueDateStr?: string | null,
  isRepaid = false,
  isStopped = false,
) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!dueDateStr || isRepaid || isStopped) return;
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [dueDateStr, isRepaid, isStopped]);

  return useMemo(
    () => computeLoanDueDateInfo(dueDateStr, now, isRepaid),
    [dueDateStr, now, isRepaid],
  );
}

/**
 * Shared body — summary + form. Rendered inside either DialogContent
 * or SheetContent depending on viewport, so the two surfaces never
 * drift out of sync with each other.
 */
function RepayLoanFormBody({
  loan,
  onClose,
}: {
  loan: RepayLoanDialogProps["loan"];
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const repayFn = useServerFn(startRepayment);

  const outstanding = Math.max(0, Number(loan.total_due) - Number(loan.amount_repaid));
  const defaultPhone = loan.disbursement_phone || profile?.phone || "";

  const [phone, setPhone] = useState(defaultPhone);
  const [repayAmount, setRepayAmount] = useState<string>(String(outstanding));
  const [showFinancialDetails, setShowFinancialDetails] = useState(false);

  useEffect(() => {
    if (defaultPhone) {
      setPhone(defaultPhone);
    }
  }, [defaultPhone]);

  useEffect(() => {
    setRepayAmount(String(outstanding));
  }, [outstanding]);

  const isRepaid = loan.status === "repaid" || outstanding <= 0;
  const dueInfo = useRealtimeDeadline(loan.due_date, isRepaid);

  const repayMutation = useMutation({
    mutationFn: async () => {
      const parsedAmount = Number(repayAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Please enter a valid amount to repay.");
      }
      if (!phone.trim()) {
        throw new Error("Please enter an M-Pesa phone number to pay with.");
      }
      return repayFn({
        data: {
          loanId: loan.id,
          amount: parsedAmount,
          phone: phone.trim(),
        },
      });
    },
    onSuccess: (res) => {
      toast.success(res.message, {
        description:
          "Waiting for M-Pesa payment confirmation... Your screen will update automatically once PIN is entered.",
        duration: 8000,
      });
      onClose();

      void queryClient.invalidateQueries({ queryKey: ["loan-center"] });
      void queryClient.invalidateQueries({ queryKey: ["my-loan-center-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["my-repayments"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });

      let polls = 0;
      const interval = setInterval(() => {
        polls++;
        void queryClient.invalidateQueries({ queryKey: ["loan-center"] });
        void queryClient.invalidateQueries({ queryKey: ["my-loan-center-dashboard"] });
        void queryClient.invalidateQueries({ queryKey: ["my-repayments"] });
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });

        if (polls >= 10) {
          clearInterval(interval);
        }
      }, 3000);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to initiate M-Pesa repayment");
    },
  });

  return (
    <div className="space-y-4 pt-2">
      <div className="rounded-lg border border-border/70 bg-muted/30 p-3.5 space-y-2.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Deadline Date & Time</span>
          <span className="font-medium text-foreground text-xs">{dueInfo.fullDeadlineText}</span>
        </div>

        <div className="flex items-center justify-between border-t border-border/40 pt-2">
          <span className="text-muted-foreground">Time Remaining</span>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${dueInfo.badgeClass}`}
          >
            <Clock className="size-3" />
            {dueInfo.daysText}
          </span>
        </div>

        {!showFinancialDetails ? (
          <div className="border-t border-border/40 pt-2">
            <button
              type="button"
              onClick={() => setShowFinancialDetails(true)}
              className="w-full flex items-center justify-between text-xs transition-colors group cursor-pointer py-0.5"
              aria-expanded={false}
            >
              <MoreHorizontal className="size-4 text-primary group-hover:text-foreground" />
              <ChevronRight className="size-4 text-primay group-hover:text-foreground" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-t border-border/40 pt-2">
              <span className="text-muted-foreground">Total Repayable</span>
              <span className="font-medium text-foreground">
                {formatKes(Number(loan.total_due))}
              </span>
            </div>

            {Number(loan.penalty_amount || 0) > 0 && (
              <div className="flex items-center justify-between border-t border-destructive/30 bg-destructive/10 -mx-3.5 px-3.5 py-1.5 text-xs text-destructive font-medium">
                <span className="flex items-center gap-1">
                  <AlertCircle className="size-3.5" />
                  Default Penalty ({loan.penalty_count || 1} x 24h cycle
                  {(loan.penalty_count || 1) > 1 ? "s" : ""}
                </span>
                <span className="font-bold">+{formatKes(Number(loan.penalty_amount))}</span>
              </div>
            )}

            {Number(loan.amount_repaid) > 0 && (
              <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                <span className="text-muted-foreground">Amount Repaid So Far</span>
                <span className="font-medium text-primary">
                  {formatKes(Number(loan.amount_repaid))}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border/40 pt-2">
              <span className="text-muted-foreground">Current Outstanding</span>
              <span className="font-semibold text-primary">{formatKes(outstanding)}</span>
            </div>

            <div className="border-t border-border/40 pt-1.5 -mb-1 flex justify-end">
              <button
                type="button"
                onClick={() => setShowFinancialDetails(false)}
                className="flex items-center justify-center p-1 text-muted-foreground/80 hover:text-foreground transition-colors cursor-pointer rounded hover:bg-background/40"
                title="Collapse balance breakdown"
                aria-label="Collapse balance breakdown"
              >
                <ChevronUp className="size-4" />
              </button>
            </div>
          </>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          repayMutation.mutate();
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label
            htmlFor="repayment-phone"
            className="text-sm font-medium flex items-center justify-between"
          >
            <span>M-Pesa Phone Number</span>
            <span className="text-xs text-muted-foreground font-normal">
              (Editable: use any line)
            </span>
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              id="repayment-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0712345678 or 254712345678"
              className="pl-9"
              required
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Enter the phone number that will receive the M-Pesa STK push payment prompt.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="repayment-amount" className="text-sm font-medium">
              Amount to Pay (KES)
            </Label>
            <span className="text-xs text-muted-foreground">Partial or Full Repayment</span>
          </div>
          <Input
            id="repayment-amount"
            type="number"
            min={1}
            max={outstanding}
            value={repayAmount}
            onChange={(e) => setRepayAmount(e.target.value)}
            required
          />
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground shrink-0">Presets:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2 py-0"
              onClick={() => setRepayAmount(String(Math.max(1, Math.round(outstanding * 0.25))))}
            >
              25%
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2 py-0"
              onClick={() => setRepayAmount(String(Math.max(1, Math.round(outstanding * 0.5))))}
            >
              50%
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2 py-0"
              onClick={() => setRepayAmount(String(Math.max(1, Math.round(outstanding * 0.75))))}
            >
              75%
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 text-xs px-2 py-0 font-semibold"
              onClick={() => setRepayAmount(String(outstanding))}
            >
              Full Amount
            </Button>
          </div>
        </div>

        {dueInfo.isOverdue && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>
              This loan is overdue. Repaying now restores your credibility score and avoids penalty
              freezes.
            </span>
          </div>
        )}

        <div className="pt-2 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={repayMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="gold"
            disabled={repayMutation.isPending || outstanding <= 0}
            className="gap-2"
          >
            {repayMutation.isPending ? (
              <LucideLoader className="size-4 animate-spin" />
            ) : (
              <Wallet className="size-4" />
            )}
            Confirm & Pay {formatKes(Number(repayAmount) || 0)}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function RepayLoanDialog({
  loan,
  trigger,
  open: externalOpen,
  onOpenChange,
}: RepayLoanDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 640px)"); // Tailwind `sm` breakpoint

  const [repayLoanId, setRepayLoanId] = useUrlStringState("repayLoanId");
  const isUrlOpen = loan?.id ? repayLoanId === loan.id : false;
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen || isUrlOpen;

  const setIsOpen = (val: boolean) => {
    setInternalOpen(val);
    if (loan?.id) {
      setRepayLoanId(val ? loan.id : null);
    }
    onOpenChange?.(val);
  };

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Wallet className="size-5 text-primary" />
              Repay Loan
            </DialogTitle>
            <DialogDescription>
              Enter the M-Pesa phone number and amount you wish to use to repay this loan.
            </DialogDescription>
          </DialogHeader>
          <RepayLoanFormBody loan={loan} onClose={() => setIsOpen(false)} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? <SheetTrigger asChild>{trigger}</SheetTrigger> : null}
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-4 pb-6">
        <SheetHeader className="text-left">
          <SheetTitle className="text-xl flex items-center gap-2">
            <Wallet className="size-5 text-primary" />
            Repay Loan
          </SheetTitle>
          <SheetDescription>
            Enter the M-Pesa phone number and amount you wish to use to repay this loan.
          </SheetDescription>
        </SheetHeader>
        <RepayLoanFormBody loan={loan} onClose={() => setIsOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
