import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Clock,
  LucideLoader,
  Phone,
  Send,
  Shield,
  UserX,
  X,
  XCircle,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  History,
  Smartphone,
  ShieldCheck,
  BellRing,
  MailCheck,
  SendHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { LoadingPage } from "@/components/loading-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import {
  activateLoan,
  cancelLoanByAdmin,
  decideLoan,
  decideLoanGuarantor,
  disburseLoan,
  getAdminLoanDetails,
} from "@/lib/loans.functions";
import { triggerOverdueDefaulterRemindersNow } from "@/lib/notifications.functions";
import { formatKes } from "@/lib/format";
import BackButton from "@/components/back-button";
import { useUrlBooleanState, useUrlStringState } from "@/lib/use-url-search-state";

export const Route = createFileRoute("/_authenticated/admin/loans/$loanId")({
  validateSearch: (search: Record<string, unknown>) => search,
  head: () => ({
    meta: [
      { title: "Loan Request Details — Admin Console" },
      {
        name: "description",
        content:
          "Manage loan request details, verify guarantors, approve or reject loan, and disburse cash to M-Pesa.",
      },
    ],
  }),
  component: AdminLoanDetailPage,
});

function AdminLoanDetailPage() {
  const { loanId } = Route.useParams();
  const { isStaff, loading, profile: currentProfile } = useAuth();
  const queryClient = useQueryClient();

  const getDetailsFn = useServerFn(getAdminLoanDetails);
  const decideLoanFn = useServerFn(decideLoan);
  const decideGuarantorFn = useServerFn(decideLoanGuarantor);
  const disburseLoanFn = useServerFn(disburseLoan);
  const cancelLoanFn = useServerFn(cancelLoanByAdmin);
  const activateLoanFn = useServerFn(activateLoan);
  const triggerDefaulterReminderFn = useServerFn(triggerOverdueDefaulterRemindersNow);

  // Rejection & Cancellation Modals
  const [rejectLoanDialogOpen, setRejectLoanDialogOpen] = useUrlBooleanState("rejectLoan");
  const [rejectLoanReason, setRejectLoanReason] = useState("");

  const [cancelLoanDialogOpen, setCancelLoanDialogOpen] = useUrlBooleanState("cancelLoan");
  const [cancelLoanReason, setCancelLoanReason] = useState("");

  const [rejectGuarantorId, setRejectGuarantorId] = useUrlStringState("rejectGuarantorId");
  const [rejectGuarantorReason, setRejectGuarantorReason] = useState("");

  const { data: loan, isLoading } = useQuery({
    queryKey: ["admin-loan-details", loanId],
    queryFn: () => getDetailsFn({ data: { loanId } }),
    enabled: isStaff && Boolean(loanId),
  });

  const activateLoanMutation = useMutation({
    mutationFn: (input: { loanId: string }) => activateLoanFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-loan-details", loanId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-loans"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelLoanMutation = useMutation({
    mutationFn: (input: { loanId: string; reason?: string }) => cancelLoanFn({ data: input }),
    onSuccess: () => {
      setCancelLoanDialogOpen(false);
      setCancelLoanReason("");
      void queryClient.invalidateQueries({ queryKey: ["admin-loan-details", loanId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-loans"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const decideLoanMutation = useMutation({
    mutationFn: (input: { loanId: string; approve: boolean; reason?: string }) =>
      decideLoanFn({ data: input }),
    onSuccess: () => {
      setRejectLoanDialogOpen(false);
      setRejectLoanReason("");
      void queryClient.invalidateQueries({ queryKey: ["admin-loan-details", loanId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-loans"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disburseMutation = useMutation({
    mutationFn: (targetLoanId: string) => disburseLoanFn({ data: { loanId: targetLoanId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-loan-details", loanId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-loans"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Disbursement failed. Loan status remains approved for retry.");
      void queryClient.invalidateQueries({ queryKey: ["admin-loan-details", loanId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-loans"] });
    },
  });

  const decideGuarantorMutation = useMutation({
    mutationFn: (input: {
      loanId: string;
      guarantorId: string;
      approve: boolean;
      reason?: string;
    }) => decideGuarantorFn({ data: input }),
    onSuccess: (_res, input) => {
      if (!input.approve) {
        toast.error("Guarantor rejected. Loan request has been automatically rejected.");
      }
      setRejectGuarantorId(null);
      setRejectGuarantorReason("");
      void queryClient.invalidateQueries({ queryKey: ["admin-loan-details", loanId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-loans"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendDefaulterReminderMutation = useMutation({
    mutationFn: () => triggerDefaulterReminderFn({ data: { forceAll: true } }),
    onSuccess: (res) => {
      toast.success(
        res.remindersDispatched > 0
          ? `Dispatched 24-hour overdue reminder notification and email successfully.`
          : `Overdue reminder check complete (${res.totalDefaultersChecked} defaulters scanned).`,
      );
      void queryClient.invalidateQueries({ queryKey: ["admin-loan-details", loanId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-loans"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (loading || isLoading || !isStaff) {
    return <LoadingPage />;
  }

  if (!loan) {
    return (
      <div className="min-h-screen bg-muted/30">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-4 py-12 text-center space-y-4">
          <AlertCircle className="size-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Loan Request Not Found</h1>
          <Button asChild variant="outline">
            <Link to="/admin">Back to Admin Console</Link>
          </Button>
        </main>
      </div>
    );
  }

  const acceptedGuarantorsCount = loan.guarantors.filter(
    (g: any) => g.status === "accepted",
  ).length;
  const isLoanPending = loan.status === "pending_guarantors" || loan.status === "pending_approval";
  const isLoanApproved = loan.status === "approved";
  const isLoanDisbursing = loan.status === "disbursing";
  const isLoanActiveOrDisbursed = ["disbursing", "active", "repaid", "defaulted"].includes(
    loan.status,
  );
  const areGuarantorsApproved = acceptedGuarantorsCount >= loan.guarantors_required;
  const isDarajaConfigured = Boolean(loan.is_daraja_configured);

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* Top Header & Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-3">
            <BackButton label="Back to Queue" className="w-fit" size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">Loan Request #{loan.id.substring(0, 8)}</h1>
                <Badge
                  variant={
                    loan.status === "active" || loan.status === "repaid"
                      ? "default"
                      : loan.status.includes("pending")
                        ? "gold"
                        : loan.status === "rejected"
                          ? "destructive"
                          : loan.status === "defaulted"
                            ? "gray"
                            : "secondary"
                  }
                >
                  {loan.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Submitted on {new Date(loan.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {isLoanPending && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={decideLoanMutation.isPending}
                      onClick={() => decideLoanMutation.mutate({ loanId: loan.id, approve: true })}
                      className="gap-2 font-semibold"
                    >
                      {decideLoanMutation.isPending ? (
                        <LucideLoader className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      Approve Loan
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-center">
                    Approves the loan application and marks it ready for M-Pesa disbursement or
                    direct activation
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={decideLoanMutation.isPending}
                      onClick={() => {
                        setRejectLoanReason("");
                        setRejectLoanDialogOpen(true);
                      }}
                      className="gap-2"
                    >
                      <XCircle className="size-4" /> Reject Loan
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-center">
                    Rejects this loan application and records an administrative reason for the
                    borrower
                  </TooltipContent>
                </Tooltip>
              </>
            )}

            {(isLoanApproved || loan.allow_activation_without_disbursement) &&
              loan.status !== "active" &&
              !["pending_guarantors", "pending_approval"].includes(loan.status) &&
              loan.status !== "repaid" &&
              loan.status !== "rejected" &&
              loan.status !== "defaulted" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={activateLoanMutation.isPending}
                      onClick={() => activateLoanMutation.mutate({ loanId: loan.id })}
                      className="gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {activateLoanMutation.isPending ? (
                        <LucideLoader className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      {loan.allow_activation_without_disbursement
                        ? "Activate Loan (Direct)"
                        : "Activate Loan"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-center">
                    Activates the loan and begins the repayment schedule without triggering an
                    automated M-Pesa fund transfer (useful for cash or offline disbursements)
                  </TooltipContent>
                </Tooltip>
              )}

            {(isLoanApproved || currentProfile?.id === loan.borrower?.id) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="gold"
                    size="sm"
                    disabled={
                      !isDarajaConfigured ||
                      !areGuarantorsApproved ||
                      disburseMutation.isPending ||
                      currentProfile?.id === loan.borrower?.id
                    }
                    onClick={() => {
                      if (isLoanPending) {
                        decideLoanMutation.mutate(
                          { loanId: loan.id, approve: true },
                          {
                            onSuccess: () => {
                              disburseMutation.mutate(loan.id);
                            },
                          },
                        );
                      } else {
                        disburseMutation.mutate(loan.id);
                      }
                    }}
                    className="gap-2 font-semibold"
                  >
                    {disburseMutation.isPending ? (
                      <LucideLoader className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Disburse via M-Pesa
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-center">
                  Disburses funds via Safaricom Daraja B2C payout directly to the borrower's M-Pesa
                  wallet and automatically activates the loan
                </TooltipContent>
              </Tooltip>
            )}

            {isLoanApproved && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={cancelLoanMutation.isPending}
                    onClick={() => {
                      setCancelLoanReason("");
                      setCancelLoanDialogOpen(true);
                    }}
                    className="gap-2"
                  >
                    <XCircle className="size-4" /> Cancel Request
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-center">
                  Cancels this approved loan request before funds are released, resetting the
                  borrower's active limit
                </TooltipContent>
              </Tooltip>
            )}

            {isLoanActiveOrDisbursed && (
              <Badge
                variant="outline"
                className="gap-1.5 py-1.5 px-3 border-primary/30 bg-primary/10 text-primary-700 font-medium"
              >
                <ShieldCheck className="size-4 text-primary-600" />
                Active Contract Locked
              </Badge>
            )}
          </div>
        </div>

        {/* Grid layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Info (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Loan Details Card */}
            <Card className="border-border/70 shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Loan Summary</span>
                  <span className="text-xl font-bold text-primary">
                    {formatKes(loan.principal)}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Financial details and repayment parameters for this request.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-muted/20 p-3.5 rounded-lg border border-border/50">
                  <div>
                    <span className="text-muted-foreground block">Tier / Product</span>
                    <span className="font-semibold text-foreground">
                      {loan.product?.name ?? "Standard Loan"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Interest Rate</span>
                    <span className="font-semibold text-foreground">
                      {loan.product?.interest_rate ? loan.product.interest_rate * 100 : 10}%
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Processing Fee</span>
                    <span className="font-semibold text-foreground">
                      {formatKes(loan.processing_fee)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Total Repayment Due</span>
                    <span className="font-semibold text-foreground text-sm">
                      {formatKes(loan.total_due)}
                    </span>
                  </div>
                  {Number(loan.penalty_amount || 0) > 0 && (
                    <div className="bg-destructive/10 p-1.5 rounded border border-destructive/20 col-span-2 sm:col-span-3">
                      <span className="text-destructive font-semibold flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1">
                          <AlertCircle className="size-3.5" />
                          24h Default Penalties Applied ({loan.penalty_count || 1} cycle
                          {(loan.penalty_count || 1) > 1 ? "s" : ""}):
                        </span>
                        <span>+{formatKes(Number(loan.penalty_amount))}</span>
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground block">Duration</span>
                    <span className="font-semibold text-foreground">
                      {loan.product?.term_days ?? 30} Days
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Disbursement M-Pesa Phone</span>
                    <span className="font-semibold text-primary flex items-center gap-1">
                      <Phone className="size-3 shrink-0" /> {loan.disbursement_phone}
                    </span>
                  </div>
                </div>

                {loan.purpose && (
                  <div className="text-xs">
                    <span className="font-medium text-muted-foreground">Stated Purpose:</span>
                    <p className="mt-1 p-2 rounded bg-background border border-border/60 text-foreground">
                      {loan.purpose}
                    </p>
                  </div>
                )}

                {loan.approved_by_user && (
                  <div className="text-xs bg-primary/5 p-2.5 rounded-lg border border-primary/20 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                      <Shield className="size-3.5 text-primary" /> Action Performed By
                      (Admin/Agent):
                    </span>
                    <span className="font-semibold text-foreground">
                      {loan.approved_by_user.name}{" "}
                      <span className="text-muted-foreground font-normal">
                        ({loan.approved_by_user.role.replace(/_/g, " ")})
                      </span>{" "}
                      — {loan.approved_by_user.email}
                    </span>
                  </div>
                )}

                {loan.rejection_reason && (
                  <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs space-y-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="size-4" /> Rejection Reason:
                    </span>
                    <p>{loan.rejection_reason}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 24-Hour Overdue Defaulter Reminder Schedule (Only for Defaulted or Past-Due Loans) */}
            {(loan.status === "defaulted" ||
              (loan.status === "active" &&
                loan.due_date &&
                new Date(loan.due_date).getTime() < Date.now())) && (
              <Card className="border-amber-500/30 bg-amber-500/5 shadow-soft">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2 text-amber-900 dark:text-amber-300">
                      <BellRing className="size-4 text-amber-600 dark:text-amber-400" />
                      24-Hour Overdue Reminder Schedule
                    </CardTitle>
                    <CardDescription className="text-xs text-amber-800/80 dark:text-amber-400/80">
                      Automated 24-hour recurring reminder cycle for loan defaulters via In-App
                      Notifications & Email.
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 text-amber-700 bg-amber-500/10"
                  >
                    Recurring Every 24h
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-background/80 p-3 rounded-lg border border-amber-500/20">
                    <div>
                      <span className="text-muted-foreground block">Defaulter Status</span>
                      <span className="font-semibold text-destructive flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="size-3.5" /> Overdue / Defaulted
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Last 24h Reminder Sent</span>
                      <span className="font-medium text-foreground block mt-0.5">
                        {loan.last_overdue_reminder_at
                          ? new Date(loan.last_overdue_reminder_at).toLocaleString()
                          : "Scheduled (Initial dispatch pending)"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Dispatch Channels</span>
                      <span className="font-medium text-foreground flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <MailCheck className="size-3.5" /> Email
                        </span>
                        <span className="inline-flex items-center gap-1 text-primary">
                          <Smartphone className="size-3.5" /> In-App
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <p className="text-xs text-muted-foreground">
                      Defaulters automatically receive high-priority reminders every 24 hours until
                      the loan is settled.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sendDefaulterReminderMutation.isPending}
                      onClick={() => sendDefaulterReminderMutation.mutate()}
                      className="gap-1.5 h-8 text-xs border-amber-500/30 hover:bg-amber-500/10"
                    >
                      {sendDefaulterReminderMutation.isPending ? (
                        <LucideLoader className="size-3.5 animate-spin" />
                      ) : (
                        <SendHorizontal className="size-3.5 text-amber-600" />
                      )}
                      Dispatch 24h Reminder Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Guarantors Card */}
            <Card className="border-border/70 shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="size-4 text-primary" />
                    Loan Guarantors Verification
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {acceptedGuarantorsCount} of {loan.guarantors_required} required guarantors
                    approved. Rejecting any guarantor automatically rejects the loan request.
                  </CardDescription>
                </div>
                <Badge
                  variant={
                    acceptedGuarantorsCount >= loan.guarantors_required ? "default" : "outline"
                  }
                >
                  {acceptedGuarantorsCount} / {loan.guarantors_required} Verified
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {loan.guarantors.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                    No guarantors linked to this loan request yet.
                  </div>
                ) : (
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Guarantor Name</TableHead>
                        <TableHead>Phone / ID</TableHead>
                        <TableHead>Relationship</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {}
                      {loan.guarantors.map((g: any) => {
                        const isAccepted = g.status === "accepted";
                        const isDeclined = g.status === "rejected";
                        return (
                          <TableRow key={g.id}>
                            <TableCell className="font-medium text-xs">
                              {`${g.first_name} ${g.last_name}`.trim() || "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div>{g.phone || "—"}</div>
                              <div className="text-[10px] text-muted-foreground">
                                ID: {g.id_number || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline">{g.relationship || "—"}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  isAccepted ? "default" : isDeclined ? "destructive" : "outline"
                                }
                                className="text-[10px] capitalize"
                              >
                                {g.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {isLoanPending && (
                                <div className="flex justify-end gap-1.5">
                                  {!isAccepted && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="default"
                                          className="h-7 px-2 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                          disabled={decideGuarantorMutation.isPending}
                                          onClick={() =>
                                            decideGuarantorMutation.mutate({
                                              loanId: loan.id,
                                              guarantorId: g.id,
                                              approve: true,
                                            })
                                          }
                                        >
                                          <Check className="size-3" /> Approve
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        Confirm and verify this guarantor for the loan application
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {!isDeclined && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                                          disabled={decideGuarantorMutation.isPending}
                                          onClick={() => {
                                            setRejectGuarantorId(g.id);
                                            setRejectGuarantorReason("");
                                          }}
                                        >
                                          <X className="size-3" /> Reject
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        Reject this guarantor (will automatically reject the loan
                                        application)
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Status Timeline History */}
            <Card className="border-border/70 shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="size-4 text-primary" />
                  Status Audit & Activity Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {loan.status_events.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No events logged yet.</p>
                  ) : (
                    loan.status_events.map((evt: any) => (
                      <div
                        key={evt.id}
                        className="flex items-start gap-3 p-2.5 rounded-md border border-border/40 text-xs"
                      >
                        <Clock className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold capitalize text-foreground">
                              {evt.status.replace(/_/g, " ")}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(evt.created_at).toLocaleString()}
                            </span>
                          </div>
                          {evt.note && <p className="text-muted-foreground">{evt.note}</p>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Borrower Info & M-Pesa Txs */}
          <div className="space-y-6">
            {/* M-Pesa Disbursement Control Card */}
            {isLoanApproved && (
              <Card className="border-border/70 shadow-soft">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Smartphone className="size-4 text-primary" />
                      M-Pesa Disbursement Control
                    </span>
                    {loan.status === "active" ? (
                      <Badge variant="default">Disbursed</Badge>
                    ) : isLoanDisbursing ? (
                      <Badge variant="secondary" className="animate-pulse">
                        Disbursing...
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{loan.status.replace(/_/g, " ")}</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Direct B2C cash payout to borrower M-Pesa phone ({loan.disbursement_phone}).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-xs border rounded-lg p-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">
                        Daraja API Credentials:
                      </span>
                      {isDarajaConfigured ? (
                        <Badge
                          variant="default"
                          className="bg-emerald-600 text-white gap-1 text-[11px]"
                        >
                          <Check className="size-3" /> Configured
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1 text-[11px]">
                          <XCircle className="size-3" /> Not Configured
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">
                        Guarantors Approved:
                      </span>
                      {areGuarantorsApproved ? (
                        <Badge
                          variant="default"
                          className="bg-emerald-600 text-white gap-1 text-[11px]"
                        >
                          <Check className="size-3" /> {acceptedGuarantorsCount} /{" "}
                          {loan.guarantors_required} Approved
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-500 text-amber-600 dark:text-amber-400 gap-1 text-[11px]"
                        >
                          <AlertTriangle className="size-3" /> {acceptedGuarantorsCount} /{" "}
                          {loan.guarantors_required} Approved
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <span className="text-muted-foreground font-medium">Net Payout Amount:</span>
                      <span className="font-bold text-foreground text-sm">
                        {formatKes(Number(loan.principal) - Number(loan.processing_fee))}
                      </span>
                    </div>
                  </div>

                  {!isDarajaConfigured && (
                    <div className="text-xs text-amber-800 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 p-3 rounded-md border border-amber-300 dark:border-amber-800 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        Daraja API Credentials Missing
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        Disbursement is disabled because Safaricom Daraja credentials (Consumer Key,
                        Secret, Passkey) are not configured.
                      </p>
                      <Link
                        to="/admin/settings"
                        className="inline-block pt-1 font-semibold text-primary hover:underline"
                      >
                        Configure Daraja Credentials &rarr;
                      </Link>
                    </div>
                  )}

                  {!areGuarantorsApproved && (
                    <div className="text-xs text-amber-800 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 p-3 rounded-md border border-amber-300 dark:border-amber-800 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        Guarantor Verification Incomplete
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        Disbursement is disabled because required guarantors (
                        {acceptedGuarantorsCount} of {loan.guarantors_required}) have not been
                        approved yet.
                      </p>
                    </div>
                  )}

                  {(isLoanApproved ||
                    isLoanPending ||
                    isLoanDisbursing ||
                    currentProfile?.id === loan.borrower?.id) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="gold"
                          size="sm"
                          className="w-full font-bold gap-2 py-2.5 shadow-sm"
                          disabled={
                            !isDarajaConfigured ||
                            !areGuarantorsApproved ||
                            disburseMutation.isPending ||
                            isLoanDisbursing ||
                            currentProfile?.id === loan.borrower?.id
                          }
                          onClick={() => {
                            if (isLoanPending) {
                              decideLoanMutation.mutate(
                                { loanId: loan.id, approve: true },
                                {
                                  onSuccess: () => {
                                    disburseMutation.mutate(loan.id);
                                  },
                                },
                              );
                            } else {
                              disburseMutation.mutate(loan.id);
                            }
                          }}
                        >
                          {disburseMutation.isPending ? (
                            <>
                              <LucideLoader className="size-4 animate-spin" /> Disbursing Payout...
                            </>
                          ) : isLoanDisbursing ? (
                            <>
                              <Clock className="size-4 animate-spin" /> Awaiting M-Pesa Callback...
                            </>
                          ) : (
                            <>
                              <Send className="size-4" /> Disburse Cash via M-Pesa
                            </>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-center">
                        Disburses funds via Safaricom Daraja B2C payout directly to the borrower's
                        M-Pesa wallet and automatically activates the loan
                      </TooltipContent>
                    </Tooltip>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Borrower Profile Card */}
            <Card className="border-border/70 shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Borrower Profile</CardTitle>
                <CardDescription className="text-xs">
                  Applicant background & account metrics.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {loan.borrower ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <Link
                        to="/admin/user/$userId"
                        params={{ userId: loan.borrower.id }}
                        className="font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        {`${loan.borrower.first_name} ${loan.borrower.last_name}`}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-medium text-foreground">{loan.borrower.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="font-medium text-foreground">
                        {loan.borrower.phone || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">National ID:</span>
                      <span className="font-medium text-foreground">
                        {loan.borrower.id_number || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Credit Score:</span>
                      <Badge variant="outline">{loan.borrower.credibility_score} pts</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Current Limit:</span>
                      <span className="font-bold text-foreground">
                        {formatKes(loan.borrower.loan_limit)}
                      </span>
                    </div>
                    <div className="pt-2">
                      <Button asChild variant="outline" size="sm" className="w-full text-xs">
                        <Link to="/admin/user/$userId" params={{ userId: loan.borrower.id }}>
                          View Full User Profile
                        </Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">No borrower info available.</p>
                )}
              </CardContent>
            </Card>

            {/* M-Pesa Disbursement Log */}
            <Card className="border-border/70 shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="size-4 text-primary" />
                  M-Pesa Payout Transactions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {loan.mpesa_txs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No M-Pesa payouts recorded yet.
                  </p>
                ) : (
                  loan.mpesa_txs.map((tx: any) => (
                    <div key={tx.id} className="p-2.5 rounded border border-border/50 space-y-1">
                      <div className="flex justify-between font-medium">
                        <span>{tx.kind.toUpperCase()}</span>
                        <Badge variant="default" className="text-[10px]">
                          {tx.status}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground flex justify-between">
                        <span>Receipt: {tx.mpesa_receipt || "—"}</span>
                        <span>{formatKes(tx.amount)}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(tx.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Dialog: Reject Loan */}
      <Dialog open={rejectLoanDialogOpen} onOpenChange={setRejectLoanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <XCircle className="size-5" /> Reject Loan Request
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provide a reason for rejecting this loan request. The applicant will be notified
              immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reject-loan-reason" className="text-xs font-medium">
              Rejection Reason
            </Label>
            <Textarea
              id="reject-loan-reason"
              placeholder="e.g., Credit criteria not met, unverified details..."
              value={rejectLoanReason}
              onChange={(e) => setRejectLoanReason(e.target.value)}
              className="text-xs"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectLoanDialogOpen(false)}
              disabled={decideLoanMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={decideLoanMutation.isPending}
              onClick={() =>
                decideLoanMutation.mutate({
                  loanId: loan.id,
                  approve: false,
                  reason: rejectLoanReason,
                })
              }
            >
              {decideLoanMutation.isPending && (
                <LucideLoader className="size-3.5 animate-spin mr-1" />
              )}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Reject Guarantor */}
      <Dialog
        open={Boolean(rejectGuarantorId)}
        onOpenChange={(open) => !open && setRejectGuarantorId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <UserX className="size-5" /> Reject Guarantor
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Rejecting this guarantor will{" "}
              <strong className="text-destructive font-semibold">
                AUTOMATICALLY REJECT the entire loan request
              </strong>{" "}
              and send a notification to the borrower.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reject-guarantor-reason" className="text-xs font-medium">
              Optional Rejection Reason
            </Label>
            <Textarea
              id="reject-guarantor-reason"
              placeholder="e.g. Guarantor contact details unverified..."
              value={rejectGuarantorReason}
              onChange={(e) => setRejectGuarantorReason(e.target.value)}
              className="text-xs"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectGuarantorId(null)}
              disabled={decideGuarantorMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={decideGuarantorMutation.isPending}
              onClick={() => {
                if (rejectGuarantorId) {
                  decideGuarantorMutation.mutate({
                    loanId: loan.id,
                    guarantorId: rejectGuarantorId,
                    approve: false,
                    reason: rejectGuarantorReason,
                  });
                }
              }}
            >
              {decideGuarantorMutation.isPending && (
                <LucideLoader className="size-3.5 animate-spin mr-1" />
              )}
              Reject Guarantor & Loan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject/Cancel Loan Dialog */}
      <Dialog open={cancelLoanDialogOpen} onOpenChange={setCancelLoanDialogOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <XCircle className="size-5" /> Reject Loan Request #{loan.id.substring(0, 8)}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to reject this loan request? The status will be set to{" "}
              <strong>rejected</strong> and the borrower will be notified. Active or cash-disbursed
              loans cannot be changed after activation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="cancel-loan-reason" className="text-xs font-medium">
              Rejection Reason (Optional)
            </Label>
            <Textarea
              id="cancel-loan-reason"
              placeholder="e.g. Rejected upon request or insufficient criteria..."
              value={cancelLoanReason}
              onChange={(e) => setCancelLoanReason(e.target.value)}
              className="text-xs"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelLoanDialogOpen(false)}
              disabled={cancelLoanMutation.isPending}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={cancelLoanMutation.isPending}
              onClick={() => {
                cancelLoanMutation.mutate({
                  loanId: loan.id,
                  reason: cancelLoanReason,
                });
              }}
            >
              {cancelLoanMutation.isPending && (
                <LucideLoader className="size-3.5 animate-spin mr-1" />
              )}
              Confirm Loan Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
