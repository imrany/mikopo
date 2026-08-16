import { Link } from "@tanstack/react-router";
import {
  Banknote,
  Users,
  TrendingUp,
  Smartphone,
  Gift,
  ArrowRight,
  ShieldCheck,
  Award,
  Sparkles,
  Calculator,
  Wallet,
  FileExclamationPoint,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatKes } from "@/lib/format";
import { LoanCalculator } from "./loan-calculator";
import { EditableLandingText } from "@/components/editable-landing-text";

export function BorrowerGuide({
  first_name,
  loan_limit,
  credibility_score,
  is_earning_points_frozen,
  businessName,
  hasActiveOrPendingOrRejectedLoan,
  contentMap = {},
  onChange = () => {},
  isStaff = false,
}: {
  first_name?: string;
  loan_limit?: number;
  credibility_score?: number;
  is_earning_points_frozen?: boolean;
  businessName: string;
  hasActiveOrPendingOrRejectedLoan?: boolean;
  contentMap?: Record<string, string>;
  onChange?: (id: string, text: string) => void;
  isStaff?: boolean;
}) {
  return (
    <div className="space-y-8">
      {/* Borrower Welcome Banner */}
      <Card className="border-border/80 bg-gradient-hero text-primary-foreground shadow-lift overflow-hidden">
        <CardContent className="p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-gold text-gold-foreground border-0 font-semibold">
                Borrower Account Active
              </Badge>
              <Badge className="bg-primary-foreground/20 text-primary-foreground border-0">
                Score: {credibility_score || 300} pts
              </Badge>
              {is_earning_points_frozen && (
                <Badge variant="gold" className="font-semibold gap-1">
                  <Lock className="size-3" /> Points Frozen
                </Badge>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-display">
              Jambo, {first_name || "Borrower"}!{" "}
              <EditableLandingText
                id="borrower_guide_title"
                defaultText={
                  hasActiveOrPendingOrRejectedLoan
                    ? "Repay your loan now"
                    : `Ready to borrow with ${businessName}`
                }
                contentMap={contentMap}
                onChange={onChange}
                isStaff={isStaff}
                as="span"
              />
            </h2>
            {!hasActiveOrPendingOrRejectedLoan ? (
              <p className="text-sm text-primary-foreground/80 leading-relaxed">
                <EditableLandingText
                  id="borrower_guide_subtitle"
                  defaultText={`Your active loan limit is ${formatKes(
                    loan_limit || 1000,
                  )}. On-time repayments increase your credibility score and unlock higher credit tiers instantly via M-Pesa.`}
                  contentMap={contentMap}
                  onChange={onChange}
                  isStaff={isStaff}
                  multiline
                  as="span"
                />
              </p>
            ) : (
              <p className="text-sm text-primary-foreground/80 leading-relaxed">
                You have an active or pending loan. Repay it to request a new one.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <Button variant="gold" size="lg" asChild>
              {!is_earning_points_frozen && (
                <Link to="/loans">
                  {!hasActiveOrPendingOrRejectedLoan ? (
                    <>
                      <Banknote className="mr-1 size-4" />
                      Request Loan ({formatKes(loan_limit || 1000)})
                    </>
                  ) : (
                    <>
                      <Wallet className="mr-1 size-4" />
                      View Loan Details
                    </>
                  )}
                </Link>
              )}
            </Button>
            <Button variant="onDark" size="lg" asChild>
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* How to Use Your Account Guide */}
      <div>
        {!hasActiveOrPendingOrRejectedLoan && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <h3 className="text-xl font-semibold">How to Use Your Account & Grow Your Limit</h3>
            </div>
          </div>
        )}

        {!hasActiveOrPendingOrRejectedLoan ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Step 1 */}
            <Card className="border-border/70 shadow-soft hover:shadow-lift transition-all">
              <CardHeader className="pb-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Banknote className="size-5" />
                </span>
                <CardTitle className="pt-2 text-sm font-semibold">1. Request a Loan</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
                <p>
                  Select an amount within your current limit ({formatKes(loan_limit || 1000)}).
                  Review repayment dates and clear interest fees upfront.
                </p>
                <div className="pt-1">
                  <Link
                    to="/loans"
                    className="text-xs font-semibold text-primary inline-flex items-center hover:underline"
                  >
                    Apply Now <ArrowRight className="ml-1 size-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Step 2 */}
            <Card className="border-border/70 shadow-soft hover:shadow-lift transition-all">
              <CardHeader className="pb-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Users className="size-5" />
                </span>
                <CardTitle className="pt-2 text-sm font-semibold">2. Invite 2 Guarantors</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
                <p>
                  Nominate 2 friends or family members with registered phone numbers. They accept
                  digitally in their account to back your loan.
                </p>
                <div className="pt-1">
                  <Link
                    to="/loans"
                    className="text-xs font-semibold text-primary inline-flex items-center hover:underline"
                  >
                    View Guarantors <ArrowRight className="ml-1 size-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card className="border-border/70 shadow-soft hover:shadow-lift transition-all">
              <CardHeader className="pb-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Smartphone className="size-5" />
                </span>
                <CardTitle className="pt-2 text-sm font-semibold">3. Receive via M-Pesa</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
                <p>
                  Once approved, funds disburse directly to your M-Pesa wallet. Track your exact
                  repayment schedule in real-time.
                </p>
              </CardContent>
            </Card>

            {/* Step 4 */}
            <Card className="border-border/70 shadow-soft hover:shadow-lift transition-all">
              <CardHeader className="pb-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <TrendingUp className="size-5" />
                </span>
                <CardTitle className="pt-2 text-sm font-semibold">4. On-Time Repayment</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
                <p>
                  Repay with 1-tap M-Pesa STK Push. Every on-time repayment awards +10 credibility
                  points and upgrades your credit tier limit.
                </p>
                <div className="pt-1">
                  <Link
                    to="/credibility"
                    className="text-xs font-semibold text-primary inline-flex items-center hover:underline"
                  >
                    View Tiers <ArrowRight className="ml-1 size-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Step 5 */}
            <Card className="border-border/70 shadow-soft hover:shadow-lift transition-all">
              <CardHeader className="pb-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Gift className="size-5" />
                </span>
                <CardTitle className="pt-2 text-sm font-semibold">5. Referral Rewards</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
                <p>
                  Share your personal referral code. Earn cash bonuses and extra score points
                  whenever your invitees settle their first loan!
                </p>
                <div className="pt-1">
                  <Link
                    to="/referrals"
                    className="text-xs font-semibold text-primary inline-flex items-center hover:underline"
                  >
                    Share Code <ArrowRight className="ml-1 size-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="border-border/70 max-w-sm shadow-soft hover:shadow-lift transition-all">
            <CardHeader className="pb-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <FileExclamationPoint className="size-5" />
              </span>
              <CardTitle className="pt-2 text-sm font-semibold text-destructive">
                Repay your loan
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>
                You have an active loan that needs to be repaid or a pending loan. Check the loan
                details to see what needs to be repaid.
              </p>
              <div className="pt-1">
                <Link
                  to="/loans"
                  className="text-xs font-semibold text-primary inline-flex items-center hover:underline"
                >
                  View Loan Details <ArrowRight className="ml-1 size-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* INTERACTIVE LOAN ESTIMATOR / CALCULATOR */}
      {!hasActiveOrPendingOrRejectedLoan && (
        <>
          <section className="mx-auto max-w-6xl px-4 py-16">
            <div className="max-w-2xl mb-8 space-y-2">
              <Badge variant="secondary" className="gap-1 text-xs">
                <Calculator className="size-3 text-primary" /> Transparent Pricing
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight">Estimate Your Loan Repayment</h2>
              <p className="text-sm text-muted-foreground">
                Select your credit tier and principal amount to calculate fees and repayment
                schedules with {businessName}.
              </p>
            </div>

            <LoanCalculator businessName={businessName} />
          </section>

          {/* Quick Action Navigation Buttons */}
          <Card className="border-border/70 bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
              <CardDescription className="text-xs">
                Jump straight to your active loan tools and credit management
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Button variant="outline" asChild className="justify-start gap-2 h-auto py-3 text-xs">
                <Link to="/loans">
                  <Banknote className="size-4 text-primary shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold">Apply / Loans</div>
                    <div className="text-[10px] text-muted-foreground">Manage active loan</div>
                  </div>
                </Link>
              </Button>

              <Button variant="outline" asChild className="justify-start gap-2 h-auto py-3 text-xs">
                <Link to="/credibility">
                  <Award className="size-4 text-primary shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold">Credibility Score</div>
                    <div className="text-[10px] text-muted-foreground">Score & tier history</div>
                  </div>
                </Link>
              </Button>

              <Button variant="outline" asChild className="justify-start gap-2 h-auto py-3 text-xs">
                <Link to="/referrals">
                  <Gift className="size-4 text-primary shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold">Refer & Earn</div>
                    <div className="text-[10px] text-muted-foreground">Share code for rewards</div>
                  </div>
                </Link>
              </Button>

              <Button variant="outline" asChild className="justify-start gap-2 h-auto py-3 text-xs">
                <Link to="/account">
                  <ShieldCheck className="size-4 text-primary shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold">Account & Security</div>
                    <div className="text-[10px] text-muted-foreground">Profile & M-Pesa phone</div>
                  </div>
                </Link>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
