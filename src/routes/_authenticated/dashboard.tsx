import { useEffect, useRef } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { fireCelebrationConfetti } from "@/lib/confetti";
import {
  Copy,
  Gift,
  Sparkles,
  TrendingUp,
  Wallet,
  Settings,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Lock,
  History,
  AlertCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UserGuarantorsManager } from "@/components/user-guarantor-form";
import { UserTestimonialForm } from "@/components/testimonial-form";
import { useAuth } from "@/lib/auth-context";
import { formatKes } from "@/lib/format";
import { getMyLoanCenter } from "@/lib/loans.functions";
import { getPublicBusinessConfig } from "@/lib/account.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSkeleton } from "@/components/ui/skeleton-loaders";
import { RepayLoanDialog, useRealtimeDeadline } from "@/components/repay-loan-dialog";
import { LoanTimeline } from "@/components/loan-timeline";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: async () => {
    try {
      const config = await getPublicBusinessConfig();
      return config;
    } catch {
      return {
        businessName: process.env["BUSINESS_NAME"] || "Lending Platform",
        businessLocation: "Nairobi, Kenya",
        supportPhone: "",
        supportEmail: "",
        logoUrl: "",
        termsContent: "",
        privacyContent: "",
      };
    }
  },
  head: ({ loaderData }) => {
    const businessName = loaderData?.businessName || "Lending Platform";
    return {
      meta: [
        { title: `Your Dashboard — ${businessName}` },
        {
          name: "description",
          content: `Track your loan limit, credibility score and referral rewards on ${businessName}.`,
        },
        { property: "og:title", content: `Your Dashboard — ${businessName}` },
        { property: "og:description", content: "Loan limit, credibility score and referrals." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Dashboard,
});

function tierFor(score: number) {
  if (score >= 850) return "Platinum";
  if (score >= 700) return "Gold";
  if (score >= 550) return "Silver";
  if (score >= 400) return "Bronze";
  return "Starter";
}

function Dashboard() {
  const { profile, canAccessUserFeatures, isStaff } = useAuth();
  const navigate = useNavigate();
  const centerFn = useServerFn(getMyLoanCenter);

  useEffect(() => {
    if (isStaff && !canAccessUserFeatures) {
      void navigate({ to: "/admin", replace: true });
    }
  }, [isStaff, canAccessUserFeatures, navigate]);

  const { data: loanCenterData, isLoading: isLoadingLoanCenter } = useQuery({
    queryKey: ["loan-center"],
    queryFn: () => centerFn(),
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  // Define the active, operational pipeline statuses that block a new loan
  const blockingStatuses = [
    "pending_guarantors",
    "pending_approval",
    "approved",
    "disbursing",
    "active",
    "defaulted",
  ];

  // Priority 1: Pick an unpaid defaulted or overdue loan first
  const defaultedLoan = (loanCenterData?.loans ?? []).find(
    (l: any) =>
      (l.status === "defaulted" ||
        (l.status === "active" &&
          l.due_date &&
          new Date(l.due_date) < new Date() &&
          Number(l.amount_repaid) < Number(l.total_due))) &&
      l.status !== "repaid",
  );

  // Priority 2: Pick active/pending pipeline loan
  const activeOrPendingLoan =
    defaultedLoan ||
    (loanCenterData?.loans ?? []).find((l: any) => blockingStatuses.includes(l.status));

  const latestLoan: any = activeOrPendingLoan || loanCenterData?.loans?.[0];

  const hasDefaultedLoan = Boolean(
    loanCenterData?.has_defaulted_loan ||
    defaultedLoan ||
    latestLoan?.status === "defaulted" ||
    (latestLoan?.status === "active" &&
      latestLoan?.due_date &&
      new Date(latestLoan.due_date) < new Date() &&
      Number(latestLoan.amount_repaid) < Number(latestLoan.total_due)),
  );

  const hasActiveOrPendingOrRejectedLoan = Boolean(
    latestLoan && (blockingStatuses.includes(latestLoan.status) || hasDefaultedLoan),
  );
  console.log(
    "hasActiveOrPendingOrRejectedLoan: " +
      hasActiveOrPendingOrRejectedLoan +
      ", latestLoan status: " +
      latestLoan?.status,
  );

  const isLatestLoanRepaid =
    latestLoan?.status === "repaid" ||
    (latestLoan && Number(latestLoan.amount_repaid) >= Number(latestLoan.total_due));

  const dueInfo = useRealtimeDeadline(latestLoan?.due_date, isLatestLoanRepaid);

  const prevLoanStatusRef = useRef<string | null>(null);
  const prevRepaidRef = useRef<number | null>(null);

  useEffect(() => {
    if (!latestLoan?.id) return;
    const currentRepaid = Number(latestLoan.amount_repaid || 0);
    if (prevRepaidRef.current !== null && currentRepaid > prevRepaidRef.current) {
      fireCelebrationConfetti();
    }
    prevRepaidRef.current = currentRepaid;
  }, [latestLoan?.id, latestLoan?.amount_repaid, latestLoan?.status]);

  useEffect(() => {
    if (!latestLoan?.status) return;
    const currentStatus = latestLoan.status;
    if (prevLoanStatusRef.current && prevLoanStatusRef.current !== currentStatus) {
      if (
        currentStatus === "repaid" ||
        currentStatus === "active" ||
        currentStatus === "disbursed" ||
        currentStatus === "approved"
      ) {
        fireCelebrationConfetti();
      }
    }
    prevLoanStatusRef.current = currentStatus;
  }, [latestLoan?.status]);

  if (!canAccessUserFeatures && isStaff) {
    return (
      <div className="min-h-screen bg-muted/30">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-4 py-16 text-center space-y-4">
          <h1 className="text-2xl font-bold">Admin Console Only</h1>
          <p className="text-muted-foreground">
            Borrower dashboard features are restricted to borrowers and allowed staff agents.
          </p>
          <Button asChild>
            <Link to="/admin">Go to Admin Console</Link>
          </Button>
        </main>
      </div>
    );
  }

  if (isLoadingLoanCenter) {
    return (
      <div className="min-h-screen bg-muted/30">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-10 space-y-8">
          <DashboardSkeleton />
        </main>
      </div>
    );
  }

  const isSandbox = Boolean(loanCenterData?.is_sandbox);
  const isAdminFrozen = Boolean(
    profile?.is_earning_points_frozen || loanCenterData?.is_admin_frozen,
  );
  const isPointsFrozen = Boolean(
    isAdminFrozen || loanCenterData?.is_frozen || isSandbox || hasDefaultedLoan,
  );
  const frozenReason =
    loanCenterData?.frozen_reason ||
    (isSandbox
      ? "Points earning is frozen in Sandbox Mode."
      : hasDefaultedLoan
        ? "Points earning is frozen due to a defaulted loan. Repay your loan to restore credibility progress."
        : isAdminFrozen
          ? "Points earning has been frozen by administration."
          : "Points earning is currently frozen.");

  const score = profile?.credibility_score ?? 300;
  const limit = Number(profile?.loan_limit ?? 0);
  const referralLink =
    typeof window !== "undefined" && profile
      ? `${window.location.origin}/auth?mode=register&ref=${profile.referral_code}`
      : "";

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">
              Karibu{profile?.first_name ? `, ${profile.first_name}` : ""}
            </h1>
            <p className="mt-1 text-muted-foreground">
              Your account status and borrowing power at a glance.
            </p>
          </div>
          <Badge variant={profile?.status === "active" ? "default" : "secondary"}>
            {profile?.status ?? "pending"}
          </Badge>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {hasActiveOrPendingOrRejectedLoan ? (
            <Card
              className={cn(
                "border-0 shadow-lift lg:col-span-2 text-primary-foreground",
                latestLoan?.status === "defaulted" || hasDefaultedLoan
                  ? "bg-linear-to-br from-red-950 via-destructive to-red-900 border border-destructive/80"
                  : "bg-gradient-hero",
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardDescription className="text-primary-foreground/80 font-medium">
                    {latestLoan.status === "defaulted" || hasDefaultedLoan
                      ? "Account Locked — Defaulter Action Required"
                      : "Loan Request Status"}
                  </CardDescription>
                  {latestLoan.status === "pending_guarantors" && (
                    <Badge variant="gold" className="gap-1.5 text-xs font-semibold">
                      <Clock className="size-3.5" /> Pending Guarantors
                    </Badge>
                  )}
                  {latestLoan.status === "pending_approval" && (
                    <Badge
                      variant="secondary"
                      className="gap-1.5 text-xs font-semibold bg-gold/80 text-primary-foreground border border-gold/90"
                    >
                      <Clock className="size-3.5" /> Pending Approval
                    </Badge>
                  )}
                  {latestLoan.status === "approved" && (
                    <Badge
                      variant="default"
                      className="gap-1.5 text-xs font-semibold bg-primary text-primary-foreground"
                    >
                      <CheckCircle2 className="size-3.5" /> Approved — Auto Disbursement
                    </Badge>
                  )}
                  {latestLoan.status === "disbursing" && (
                    <Badge
                      variant="secondary"
                      className="gap-1.5 text-xs font-semibold bg-primary/20 text-primary-foreground border border-primary-foreground/30"
                    >
                      <Clock className="size-3.5" /> Disbursing Funds
                    </Badge>
                  )}
                  {latestLoan.status === "active" && (
                    <Badge
                      variant="default"
                      className="gap-1.5 text-xs font-semibold bg-primary text-primary-foreground border-0 shadow-xs"
                    >
                      <CheckCircle2 className="size-3.5" /> Active Loan
                    </Badge>
                  )}
                  {latestLoan.status === "repaid" && (
                    <Badge
                      variant="default"
                      className="gap-1.5 text-xs font-semibold bg-primary text-primary-foreground border-0 shadow-xs"
                    >
                      <CheckCircle2 className="size-3.5" /> Fully Repaid
                    </Badge>
                  )}
                  {latestLoan.status === "rejected" && (
                    <Badge variant="destructive" className="gap-1.5 text-xs font-semibold">
                      <XCircle className="size-3.5" /> Request Rejected
                    </Badge>
                  )}
                  {latestLoan.status === "defaulted" && (
                    <Badge className="gap-1.5 text-xs font-semibold border-0 bg-white hover:bg-white hover:text-destructive text-destructive shadow-sm">
                      <Lock className="size-3.5" /> Account Locked (Defaulter)
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-3xl pt-1">
                  {formatKes(latestLoan.principal)}
                  <span className="text-sm font-normal text-primary-foreground/70 ml-2">
                    ({latestLoan.loan_products?.name || `Loan`})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-primary-foreground/80">
                  {latestLoan.status === "pending_guarantors" &&
                    "Submitted loan request — awaiting guarantor approval before proceeding to review."}
                  {latestLoan.status === "pending_approval" &&
                    "Guarantors approved! Submitted loan request is now awaiting final admin approval."}
                  {latestLoan.status === "approved" &&
                    "Loan request approved! Automatic disbursement of funds is being triggered."}
                  {latestLoan.status === "disbursing" &&
                    "Funds are currently being disbursed directly to your M-Pesa mobile wallet."}
                  {latestLoan.status === "active" &&
                    `Funds disbursed! Remaining balance: ${formatKes(Math.max(0, Number(latestLoan.total_due) - Number(latestLoan.amount_repaid)))} of ${formatKes(latestLoan.total_due)}.`}
                  {latestLoan.status === "repaid" &&
                    "Congratulations! You have fully repaid your loan."}
                  {latestLoan.status === "rejected" &&
                    "Your loan request got rejected by administration or guarantors."}
                  {latestLoan.status === "defaulted" &&
                    "Your account is locked from requesting or accessing new loans because this loan defaulted. Repay your balance below to unlock your account."}
                </p>

                {Number(latestLoan.penalty_amount || 0) > 0 && (
                  <div className="rounded-lg bg-destructive/90 text-destructive-foreground px-3.5 py-2 text-xs flex items-center justify-between border border-destructive-foreground/20 font-medium">
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="size-4" />
                      Default Penalty ({latestLoan.penalty_count || 1} x 24h cycle
                      {(latestLoan.penalty_count || 1) > 1 ? "s" : ""}):
                    </span>
                    <span className="font-bold">
                      +{formatKes(Number(latestLoan.penalty_amount))}
                    </span>
                  </div>
                )}

                {(latestLoan.status === "active" ||
                  latestLoan.status === "disbursed" ||
                  latestLoan.status === "defaulted" ||
                  hasDefaultedLoan) &&
                  latestLoan.status !== "repaid" &&
                  Number(latestLoan.amount_repaid) < Number(latestLoan.total_due) && (
                    <div className="space-y-3.5 my-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl bg-black/25 p-3.5 text-xs backdrop-blur-xs border border-white/10">
                        <div>
                          <span className="text-primary-foreground/70 block font-medium">
                            Deadline & Time
                          </span>
                          <span className="font-semibold text-xs text-primary-foreground block mt-0.5">
                            {dueInfo.fullDeadlineText}
                          </span>
                          <span className="text-[11px] font-semibold text-gold flex items-center gap-1 mt-1">
                            <Clock className="size-3 text-gold shrink-0 animate-pulse" />
                            {dueInfo.daysText}
                          </span>
                        </div>
                        <div>
                          <span className="text-primary-foreground/70 block font-medium">
                            Repaid / Total
                          </span>
                          <span className="font-semibold text-sm text-primary-foreground block mt-0.5">
                            {formatKes(latestLoan.amount_repaid)} /{" "}
                            {formatKes(latestLoan.total_due)}
                          </span>
                        </div>
                        <div>
                          <span className="text-primary-foreground/70 block font-medium">
                            Outstanding Due
                          </span>
                          <span className="font-bold text-sm text-gold block mt-0.5">
                            {formatKes(
                              Math.max(
                                0,
                                Number(latestLoan.total_due) - Number(latestLoan.amount_repaid),
                              ),
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                <div className="flex flex-wrap items-center gap-3">
                  {(latestLoan.status === "active" ||
                    latestLoan.status === "disbursed" ||
                    latestLoan.status === "defaulted" ||
                    hasDefaultedLoan) &&
                    latestLoan.status !== "repaid" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <RepayLoanDialog
                              loan={latestLoan}
                              trigger={
                                <Button
                                  variant={
                                    latestLoan.status === "defaulted" || hasDefaultedLoan
                                      ? "destructive"
                                      : "gold"
                                  }
                                  size="lg"
                                  className={cn(
                                    "shadow-md font-semibold",
                                    (latestLoan.status === "defaulted" || hasDefaultedLoan) &&
                                      "bg-white text-destructive hover:bg-white/90 border-0",
                                  )}
                                >
                                  <Wallet className="size-4 mr-1.5" />
                                  {latestLoan.status === "defaulted" || hasDefaultedLoan
                                    ? "Repay Defaulted Loan"
                                    : "Repay Loan"}
                                </Button>
                              }
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Initiate an M-Pesa STK push prompt on your phone or use Paybill to repay
                          your outstanding balance
                        </TooltipContent>
                      </Tooltip>
                    )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="lg"
                        className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20 hover:text-white"
                        asChild
                      >
                        <Link to="/loans">
                          View Loan Details <ArrowRight className="size-4 ml-1" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      View complete repayment schedule, interest breakdown, and loan statement
                    </TooltipContent>
                  </Tooltip>
                </div>

                <details className="pt-3">
                  <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-primary-foreground/90 hover:text-white transition-colors">
                    <History className="size-3.5 text-gold" />
                    Loan Status Timeline
                  </summary>
                  <motion.div
                    className="mt-3 bg-background/95 rounded-lg p-3.5 text-foreground shadow-sm"
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <LoanTimeline loanId={latestLoan.id} />
                  </motion.div>
                </details>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 bg-gradient-hero text-primary-foreground shadow-lift lg:col-span-2">
              <CardHeader>
                <CardDescription className="text-primary-foreground/70">
                  Available loan limit
                </CardDescription>
                <CardTitle className="text-4xl">
                  {profile ? (
                    formatKes(limit)
                  ) : (
                    <Skeleton className="h-9 w-36 bg-white/20 inline-block rounded-md" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="gold" size="lg" asChild>
                        <Link to="/loans">
                          <Wallet /> Request a loan
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Choose an available loan tier, calculate interest rates, and apply with
                      digital guarantors
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-xs text-primary-foreground/70">
                    Pick a tier, add guarantors and get paid straight to M-Pesa.
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/70 shadow-soft">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <TrendingUp className="size-5 text-primary" aria-hidden />
                  <CardTitle className="pt-2 text-base">Credibility score</CardTitle>
                </div>
                {isPointsFrozen && (
                  <Badge variant="gold" className="gap-1 text-xs">
                    <Lock className="size-3" /> Points Frozen
                  </Badge>
                )}
              </div>
              <CardDescription>{tierFor(score)} tier</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <p
                  className={`font-display text-3xl font-semibold ${isPointsFrozen ? "text-muted-foreground" : ""}`}
                >
                  {score} pts
                </p>
              </div>
              <Progress className="mt-4" value={Math.min(100, (score / 850) * 100)} />
              {isPointsFrozen && (
                <p className="mt-3 text-xs text-amber-500 font-medium flex items-center gap-1.5 leading-relaxed">
                  <Lock className="size-3.5 shrink-0" />
                  <span>{frozenReason}</span>
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div id="referral" className="mt-6 grid gap-6 md:grid-cols-2">
          <Card className="border-border/70 shadow-soft">
            <CardHeader>
              <Gift className="size-5 text-primary" aria-hidden />
              <CardTitle className="pt-2 text-base">Your referral code</CardTitle>
              <CardDescription>Earn once your invitee repays their first loan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="font-display text-2xl font-semibold tracking-widest">
                {profile?.referral_code ?? "—"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(referralLink);
                  }}
                >
                  <Copy /> Copy invite link
                </Button>
                <Button variant="ghost" size="sm" asChild className="text-xs text-primary">
                  <Link to="/referrals">
                    View Referrals <ArrowRight className="ml-1 size-3" />
                  </Link>
                </Button>
              </div>
              {isPointsFrozen && (
                <p className="pt-1 text-xs text-amber-500 font-medium flex items-center gap-1">
                  <Lock className="size-3 shrink-0" />{" "}
                  {isSandbox
                    ? "Points earning is frozen in Sandbox Mode."
                    : "Points earning is frozen due to active loan."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <Sparkles className="size-5 text-primary" aria-hidden />
                <CardTitle className="pt-2 text-base">Account details</CardTitle>
              </div>
              <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
                <Link to="/account">
                  <Settings className="size-3.5" /> Account Settings
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 text-sm pt-2">
              <Row
                label="Full Name"
                value={`${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "—"}
              />
              <Row label="Phone" value={profile?.phone ?? "—"} />
              <Row label="ID number" value={profile?.id_number ?? "—"} />
              <Row label="Email" value={profile?.email ?? "—"} note="Read-only" />
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 space-y-8">
          <UserGuarantorsManager />
          <UserTestimonialForm />
        </div>
      </main>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5 truncate">
        <span className="truncate font-medium">{value}</span>
        {note && (
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/60">
            {note}
          </span>
        )}
      </div>
    </div>
  );
}
