import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Copy, Check, Share2, Award, Zap, UserCheck, Gift, Lock } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { DashboardSkeleton } from "@/components/ui/skeleton-loaders";
import { useRealtimeSync } from "@/hooks/use-realtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getReferralData } from "@/lib/referral.functions";
import { getPublicBusinessConfig } from "@/lib/account.functions";
import { useAppConfig } from "@/lib/config-context";
import { useAuth } from "@/lib/auth-context";
import BackButton from "@/components/back-button";

export const Route = createFileRoute("/_authenticated/referrals")({
  loader: async () => {
    return getPublicBusinessConfig();
  },
  head: ({ loaderData }) => {
    const businessName = loaderData?.businessName || "Lending Platform";
    return {
      meta: [
        { title: `Referrals & Rewards — ${businessName}` },
        {
          name: "description",
          content: `Invite friends to ${businessName}, earn credibility points, and unlock higher loan limits.`,
        },
        { property: "og:title", content: `Referrals & Rewards — ${businessName}` },
        {
          property: "og:description",
          content: "Get your unique referral code and earn credibility points.",
        },
      ],
    };
  },
  component: ReferralPage,
});

function ReferralPage() {
  const { canAccessUserFeatures, isStaff } = useAuth();
  const { businessName } = useAppConfig();
  const activeBusinessName = businessName || "our platform";
  const getReferralsFn = useServerFn(getReferralData);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["referrals-overview"],
    queryFn: () => getReferralsFn(),
  });

  useRealtimeSync(
    ["REFERRAL_UPDATED", "CREDIBILITY_UPDATED", "USER_PROFILE_UPDATED"],
    () => {
      void refetch();
    },
    { intervalMs: 8000 },
  );

  const [siteOrigin, setSiteOrigin] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSiteOrigin(window.location.origin);
    }
  }, []);

  if (!canAccessUserFeatures && isStaff) {
    return (
      <div className="min-h-screen bg-muted/30">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-4 py-16 text-center space-y-4">
          <h1 className="text-2xl font-bold">Admin Console Only</h1>
          <p className="text-muted-foreground">
            Borrower referral features are restricted to borrowers and allowed staff agents.
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
              Could not load referral data. Please refresh or try again.
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const referralCode = data.referralCode;
  const referralLink = `${siteOrigin}/auth?mode=register&ref=${referralCode}`;

  function copyCodeToClipboard() {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function copyLinkToClipboard() {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  const activeReferees = data.referees.filter((r: any) => r.hasRepaidLoan).length;

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 space-y-8">
        <BackButton label="Back to Dashboard" to="/dashboard" className="-ml-2 mb-2" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Referral Program</h1>
            <p className="mt-1 text-muted-foreground">
              Invite friends to join {activeBusinessName}. Earn +5 credibility points every time a
              referred friend repays their first loan.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data.isFrozen ? (
              <Badge variant="gold" className="gap-1 font-semibold text-xs px-3 py-1">
                <Lock className="size-3" /> Points Frozen
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="text-xs text-muted-foreground px-3 py-1 font-medium"
              >
                Current Score:{" "}
                <strong className="ml-1 text-primary">{data.currentScore} pts</strong>
              </Badge>
            )}
          </div>
        </div>

        {/* Hero Banner with Code & Link */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-0 bg-gradient-hero text-primary-foreground shadow-soft lg:col-span-2 overflow-hidden relative">
            <CardContent className="p-8 space-y-6 relative z-10">
              <div className="flex items-center gap-2 text-primary">
                <Gift className="h-5 w-5 text-gold" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Your Exclusive Referral Link
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col lg:flex-row gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-slate-300 font-medium">
                      Your Unique Referral Code
                    </label>
                    <div className="flex items-center gap-2 bg-secondary border border-primary rounded-xl p-2 px-3">
                      <span className="font-mono text-xl font-bold tracking-widest text-primary flex-1">
                        {referralCode}
                      </span>
                      <Button
                        size="sm"
                        variant="hero"
                        onClick={copyCodeToClipboard}
                        className="h-8 gap-1.5 text-xs"
                      >
                        {copiedCode ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        {copiedCode ? "Copied" : "Copy Code"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-slate-300 font-medium">
                      Direct Registration Link
                    </label>
                    <div className="flex items-center gap-2 bg-secondary border border-primary rounded-xl p-2 px-3">
                      <span className="text-xs text-primary truncate flex-1 font-mono">
                        {`...${referralLink.split("=")[1]}=${referralLink.split("=")[2]}`}
                      </span>
                      <Button
                        size="sm"
                        variant="hero"
                        onClick={copyLinkToClipboard}
                        className="h-8 gap-1.5 text-xs"
                      >
                        {copiedLink ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Share2 className="h-3.5 w-3.5" />
                        )}
                        {copiedLink ? "Copied" : "Copy Link"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {data.isFrozen ? (
                <div className="p-4 rounded-xl bg-gold text-xs text-foreground flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-foreground shrink-0" />
                    <span>
                      {data.isSandbox ? (
                        <>
                          Your credibility points earning is currently{" "}
                          <strong>frozen in Sandbox Mode at {data.currentScore} pts</strong>.
                        </>
                      ) : (
                        <>
                          Your credibility points earning is currently{" "}
                          <strong>frozen at {data.currentScore} pts</strong> due to an active loan.
                          Points for new referrals will be awarded after loan repayment.
                        </>
                      )}
                    </span>
                  </div>
                  {!data.isSandbox && (
                    <Button
                      size="sm"
                      variant="destructive"
                      asChild
                      className="shrink-0 h-8 text-xs"
                    >
                      <Link to="/loans">Repay Loan</Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-secondary border border-primary text-xs text-primary flex items-start gap-3">
                  <Zap className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-gold">How it works:</strong> Share your code or link
                    with friends. When they register using your referral link and successfully repay
                    their first loan, +5 credibility points are automatically awarded to your
                    profile score!
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Referral Stats Summary */}
          <div className="space-y-4">
            <Card className="border-border/70 shadow-soft">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Friends Invited</p>
                  <p className="text-3xl font-extrabold mt-1">{data.totalReferees}</p>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <Users className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-soft">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Active Borrowers</p>
                  <p className="text-3xl font-extrabold mt-1 text-emerald-600 dark:text-emerald-400">
                    {activeReferees}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Repaid 1st loan</p>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <UserCheck className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-soft">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Points Contributed</p>
                  <p className="text-3xl font-extrabold mt-1 text-amber-600 dark:text-amber-400">
                    +{data.totalPointsEarned} pts
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  <Award className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Referred Friends Table */}
        <Card className="border-border/70 shadow-soft">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Referred Friends List</CardTitle>
                <CardDescription>Members who registered using your referral code</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {data.referees.length} total referrals
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {data.referees.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-base">No referrals yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Share your referral link with colleagues and friends. Once they register and repay
                  a loan, you will earn bonus credibility points.
                </p>
                <Button size="sm" onClick={copyLinkToClipboard} className="gap-2 mt-2">
                  <Share2 className="h-4 w-4" /> Share Link Now
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Joined Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Points Earned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.referees.map((ref: any) => (
                    <TableRow key={ref.id}>
                      <TableCell className="font-medium">{ref.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {ref.email}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(ref.joinedAt).toLocaleDateString("en-KE", {
                          dateStyle: "medium",
                        })}
                      </TableCell>
                      <TableCell>
                        {ref.hasRepaidLoan ? (
                          <Badge
                            variant="default"
                            className="bg-emerald-600 hover:bg-emerald-700 text-[11px]"
                          >
                            <Check className="h-3 w-3 mr-1" /> Repaid 1st Loan
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[11px]">
                            Registered
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                        +{ref.pointsEarned} pts
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
