import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Award,
  TrendingUp,
  ShieldCheck,
  Users,
  CheckCircle2,
  Lock,
  ArrowRight,
  Zap,
  Star,
  Wallet,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { DashboardSkeleton } from "@/components/ui/skeleton-loaders";
import { useRealtimeSync } from "@/hooks/use-realtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getCredibilityData } from "@/lib/credibility.functions";
import { getPublicBusinessConfig } from "@/lib/account.functions";
import { useAppConfig } from "@/lib/config-context";
import { formatKes } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { getDarajaEnvironment } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";
import BackButton from "@/components/back-button";

export const Route = createFileRoute("/_authenticated/credibility")({
  loader: async () => {
    return getPublicBusinessConfig();
  },
  head: ({ loaderData }) => {
    const businessName = loaderData?.businessName || "Lending Platform";
    return {
      meta: [
        { title: `Credibility Score & Points — ${businessName}` },
        {
          name: "description",
          content: `Track your ${businessName} credibility score, see tier progress, and learn how to boost your loan limits.`,
        },
        { property: "og:title", content: `Credibility Score & Points — ${businessName}` },
        {
          property: "og:description",
          content: "Track your credibility score and unlock higher loan tiers.",
        },
      ],
    };
  },
  component: CredibilityPage,
});

function CredibilityPage() {
  const { canAccessUserFeatures, isStaff, session } = useAuth();
  const { businessName } = useAppConfig();
  const activeBusinessName = businessName || "our platform";
  const getOverviewFn = useServerFn(getCredibilityData);
  const envFn = useServerFn(getDarajaEnvironment);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["credibility-overview"],
    queryFn: () => getOverviewFn(),
  });

  useRealtimeSync(
    ["CREDIBILITY_UPDATED", "PAYMENT_RECEIVED", "LOAN_STATUS_CHANGED", "REFERRAL_UPDATED"],
    () => {
      void refetch();
    },
    { intervalMs: 8000 },
  );

  const envQuery = useQuery({
    queryKey: ["daraja-env"],
    queryFn: () => envFn(),
    enabled: Boolean(session),
    staleTime: 30_000,
  });

  const isSandbox = Boolean(data?.isSandbox || envQuery.data?.environment === "sandbox");

  if (!canAccessUserFeatures && isStaff) {
    return (
      <div className="min-h-screen bg-muted/30">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-4 py-16 text-center space-y-4">
          <h1 className="text-2xl font-bold">Admin Console Only</h1>
          <p className="text-muted-foreground">
            Credibility score features are restricted to borrowers and allowed staff agents.
          </p>
          <Button asChild>
            <Link to="/admin">Go to Admin Console</Link>
          </Button>
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
          <DashboardSkeleton />
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-muted/30">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-12">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-6 text-center text-destructive">
              Could not load credibility data. Please refresh or try again.
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const score = data.score;
  const minScore = data.minScore ?? 0;
  const maxScore = data.maxScore ?? 1000;
  const scoreRange = Math.max(1, maxScore - minScore);
  const scorePercentage = Math.min(
    100,
    Math.max(0, Math.round(((score - minScore) / scoreRange) * 100)),
  );

  const sortedProducts = [...data.products].sort((a, b) => a.minCredibility - b.minCredibility);
  const matrixProducts = isSandbox
    ? sortedProducts.filter((p) => p.isTestTier || p.name.toLowerCase().includes("sandbox"))
    : sortedProducts;
  const displayMatrixProducts =
    matrixProducts.length > 0 ? matrixProducts : sortedProducts.slice(0, 1);

  const currentTier =
    sortedProducts.filter((p) => score >= p.minCredibility).pop() || sortedProducts[0];
  const nextTier = sortedProducts.find((p) => score < p.minCredibility);
  const pointsToNext = nextTier ? nextTier.minCredibility - score : 0;

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 space-y-8">
        <div>
          <BackButton label="Back to Dashboard" to="/dashboard" className="-ml-2 mb-2" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Credibility Score & Points</h1>
              <p className="mt-1 text-muted-foreground">
                Your score determines your borrowing capacity, loan limits, and interest rates.
              </p>
            </div>
            <Button variant="hero" asChild>
              <Link to="/loans">
                <Wallet className="mr-2 h-4 w-4" /> Request a Loan
              </Link>
            </Button>
          </div>
        </div>

        {/* Current Score Hero Banner */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-0 bg-gradient-hero text-primary-foreground shadow-soft lg:col-span-2 overflow-hidden relative">
            <CardContent className="p-8 space-y-6 relative z-10">
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className={`${currentTier?.name === "Platinum" ? "bg-gold border-gold/40" : "bg-primary border-primary/40"} text-primary-foreground px-3 py-1 text-xs`}
                >
                  <Award
                    className={`mr-1.5 h-3.5 w-3.5 ${currentTier?.name === "Platinum" ? "text-primary" : "text-gold"}`}
                  />
                  {currentTier?.name ?? "Starter"} Tier Member
                </Badge>
                {data.isFrozen && (
                  <Badge variant="gold" className="gap-1 font-semibold">
                    <Lock className="size-3" /> Points Frozen
                  </Badge>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-emerald-300/80 font-medium">
                    Your Credibility Score
                  </p>
                  <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                    <span
                      className={cn({
                        "text-5xl font-black tracking-tight": true,
                        "text-white": !data.isFrozen,
                        "text-muted-foreground": data.isFrozen,
                      })}
                    >
                      {score}
                    </span>
                    <span className="text-lg text-primary-foreground/80">/ {maxScore} pts</span>
                  </div>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs">Active Loan Limit</p>
                  <p className="text-2xl font-bold text-emerald-400">{formatKes(data.loanLimit)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs overflow-x-auto gap-2">
                  {sortedProducts.length > 0 ? (
                    sortedProducts.map((p) => (
                      <span key={p.id}>
                        {p.name} ({p.minCredibility} pts)
                      </span>
                    ))
                  ) : (
                    <>
                      <span>Min ({minScore} pts)</span>
                      <span>Max ({maxScore} pts)</span>
                    </>
                  )}
                </div>
                <Progress value={scorePercentage} className="h-3 bg-secondary" />
              </div>

              {data.isFrozen ? (
                <Badge
                  variant="gold"
                  className="flex flex-wrap items-center justify-between gap-3 text-xs p-4 rounded-xl"
                >
                  <div className="flex items-center gap-2">
                    <Lock className="h-3 w-3 shrink-0" />
                    <span>
                      {data.frozenReason ? (
                        <>
                          {data.frozenReason} Current score: <strong>{score} pts</strong>.
                        </>
                      ) : isSandbox ? (
                        <>
                          All points are <strong>frozen in Sandbox Mode</strong> ({score} pts).
                          Credibility score updates are suspended during testing.
                        </>
                      ) : data.hasDefaultedLoan ? (
                        <>
                          Points earning is <strong>frozen due to a defaulted loan</strong> ({score}{" "}
                          pts). Repay your defaulted balance to restore score progress.
                        </>
                      ) : (
                        <>
                          Your points earning is currently <strong>frozen at {score} pts</strong> by
                          administration.
                        </>
                      )}
                    </span>
                  </div>
                  {data.hasDefaultedLoan && (
                    <Link
                      to="/loans"
                      className="hover:underline font-semibold shrink-0 flex items-center text-white bg-destructive/60 hover:bg-destructive/80 px-3 py-1.5 rounded-md border border-destructive/70"
                    >
                      Repay Defaulted Loan <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  )}
                </Badge>
              ) : nextTier ? (
                <div className="flex items-center justify-between rounded-xl bg-secondary border border-primary/60 p-4 text-xs text-primary">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>
                      You are <strong>{pointsToNext} points away</strong> from unlocking{" "}
                      <strong>{nextTier.name} Tier</strong> ({nextTier.minCredibility}+ pts)
                    </span>
                  </div>
                  <Link
                    to="/referrals"
                    className="hover:underline font-medium shrink-0 flex items-center"
                  >
                    Earn pts <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <div className="rounded-xl bg-secondary text-primary border border-primary p-4 text-xs flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    Congratulations! You have achieved the maximum <strong>Platinum Tier</strong>{" "}
                    status!
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Points Breakdown Quick Summary */}
          <Card className="border-border/70 shadow-soft flex flex-col justify-between">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Score Breakdown
              </CardTitle>
              <CardDescription>Points earned across activities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm flex-1 flex flex-col justify-center">
              <ScoreRow
                label="On-time Loan Repayments"
                value={`+${data.stats.repaidPoints} pts`}
                count={`${data.stats.repaidLoansCount} repaid`}
              />
              <ScoreRow
                label="Guarantor Verifications"
                value={`+${data.stats.guarantorPoints} pts`}
                count={`${data.stats.guarantorsCount} added`}
              />
              <ScoreRow
                label="Successful Referrals"
                value={`+${data.stats.referralPoints} pts`}
                count={`${data.stats.refereesCount} referred`}
              />
              <ScoreRow
                label="Testimonials & Reviews"
                value={`+${data.stats.testimonialPoints} pts`}
                count={`${data.stats.testimonialsCount} approved`}
              />
            </CardContent>
          </Card>
        </div>

        {/* How to Improve Your Score Matrix */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                How to Increase Your Score & Points
              </h2>
              <p className="text-sm text-muted-foreground">
                Four proven ways to earn credibility points and raise your loan limit
              </p>
            </div>
          </div>

          {isSandbox && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-300">
              <Lock className="size-4 shrink-0 text-amber-500" />
              <span>
                Points earning is frozen in Sandbox Mode. Points will resume accumulating in
                Production mode.
              </span>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/70 shadow-soft hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">1. Repay Loans On Time</CardTitle>
                <Badge
                  variant="outline"
                  className="w-fit text-xs border-border/20 bg-primary/10 text-primary"
                >
                  +10 Pts Per Loan
                </Badge>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-3">
                <p>
                  Every loan repaid in full before or on its due date automatically awards +10
                  credibility points and increases your loan limit by up to 20%.
                </p>
                <Button size="sm" variant="outline" className="w-full text-xs" asChild>
                  <Link to="/loans">View Active Loans</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-soft hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                  <Users className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">2. Invite Friends</CardTitle>
                <Badge
                  variant="outline"
                  className="w-fit text-xs border-border/20 bg-primary/10 text-primary"
                >
                  +5 Pts Per Active Ref
                </Badge>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-3">
                <p>
                  Share your unique referral code. When your friend registers and completes their
                  first loan repayment, you earn +5 credibility points!
                </p>
                <Button size="sm" variant="outline" className="w-full text-xs" asChild>
                  <Link to="/referrals">Get Referral Link</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-soft hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">3. Save Guarantors</CardTitle>
                <Badge
                  variant="outline"
                  className="w-fit text-xs border-border/20 bg-primary/10 text-primary"
                >
                  +5 Pts Per Guarantor
                </Badge>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-3">
                <p>
                  Add trusted guarantors to your profile directory to speed up loan approvals and
                  prove peer trust (up to +20 total points).
                </p>
                <Button size="sm" variant="outline" className="w-full text-xs" asChild>
                  <Link to="/dashboard">Manage Guarantors</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-soft hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                  <Star className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">4. Share Feedback</CardTitle>
                <Badge
                  variant="outline"
                  className="w-fit text-xs border-primary/20 bg-primary/10 text-primary"
                >
                  +5 Pts Per Review
                </Badge>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-3">
                <p>
                  Submit a member testimonial sharing your experience with {activeBusinessName}.
                  Once approved by staff, receive a +5 points bonus.
                </p>
                <Button size="sm" variant="outline" className="w-full text-xs" asChild>
                  <Link to="/dashboard">Submit Review</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Loan Tier Unlock Roadmap */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Loan Tier Eligibility Matrix</h2>
            <p className="text-sm text-muted-foreground">
              {isSandbox
                ? "Sandbox Mode active — showing Sandbox Test Tier"
                : `Compare borrowing limits and requirements across all ${activeBusinessName} tiers`}
            </p>
          </div>

          <div
            className={`grid gap-4 ${
              isSandbox ? "grid-cols-1 max-w-md" : "md:grid-cols-3 lg:grid-cols-5"
            }`}
          >
            {displayMatrixProducts.map((product) => {
              const unlocked = score >= product.minCredibility;
              const isCurrent = currentTier?.id === product.id;

              return (
                <Card
                  key={product.id}
                  className={`border-border/70 shadow-soft relative flex flex-col justify-between ${
                    isCurrent
                      ? "ring-2 ring-primary bg-primary/5"
                      : unlocked
                        ? "bg-background"
                        : "bg-muted/40 opacity-80"
                  }`}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{product.name}</CardTitle>
                      {unlocked ? (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-emerald-600">
                          Unlocked
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          <Lock className="h-3 w-3 mr-1 inline" /> {product.minCredibility} pts
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs line-clamp-2">
                      {product.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 space-y-2 text-xs flex-1 flex flex-col justify-end">
                    <div className="border-t border-border/50 pt-2 space-y-1">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Range:</span>
                        <span className="font-semibold text-foreground">
                          {formatKes(product.minAmount)} – {formatKes(product.maxAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Min Score:</span>
                        <span className="font-semibold text-foreground">
                          {product.minCredibility} pts
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={isCurrent ? "default" : unlocked ? "outline" : "secondary"}
                      className="w-full mt-2 text-xs"
                      disabled={!unlocked}
                      asChild
                    >
                      <Link to="/loans">
                        {isCurrent
                          ? "Current Tier"
                          : unlocked
                            ? "Request Loan"
                            : `Need ${product.minCredibility - score} pts`}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function ScoreRow({ label, value, count }: { label: string; value: string; count: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 text-sm">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{count}</p>
      </div>
      <span className="font-bold text-primary">{value}</span>
    </div>
  );
}
