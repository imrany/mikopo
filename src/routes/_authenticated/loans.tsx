import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Check,
  Download,
  History,
  LucideLoader,
  FlaskConical,
  ShieldCheck,
  Wallet,
  Lock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { LoanTimeline } from "@/components/loan-timeline";
import { RepayLoanDialog, useRealtimeDeadline } from "@/components/repay-loan-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getMyLoanCenter,
  getRepaymentReceipt,
  listLoanProducts,
  listMyRepayments,
  listUserGuarantors,
  requestLoan,
  respondToGuarantee,
} from "@/lib/loans.functions";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { formatKes } from "@/lib/format";
import { useRealtimeTable } from "@/hooks/use-realtime";
import { generateReceiptPDF } from "@/lib/receipt-pdf";
import { fireCelebrationConfetti } from "@/lib/confetti";
import type { UserGuarantor, LoanProduct } from "@/generated/client";
import { KeysToSnakeCase, keysToSnakeCase, cn } from "@/lib/utils";
import { z } from "zod";
import { getDarajaEnvironment } from "@/lib/admin.functions";
import { getPublicBusinessConfig } from "@/lib/account.functions";
import { useAppConfig } from "@/lib/config-context";
import BackButton from "@/components/back-button";

const loansSearchSchema = z
  .object({
    tab: z.string().optional(),
  })
  .passthrough();

export const Route = createFileRoute("/_authenticated/loans")({
  validateSearch: loansSearchSchema,
  loader: async () => {
    return getPublicBusinessConfig();
  },
  head: ({ loaderData }) => {
    const businessName = loaderData?.businessName || "Lending Platform";
    return {
      meta: [
        { title: `Loans & tiers — ${businessName}` },
        {
          name: "description",
          content: `Compare ${businessName} loan tiers, request a loan with guarantors and repay instantly over M-Pesa.`,
        },
        { property: "og:title", content: `Loans & tiers — ${businessName}` },
        { property: "og:description", content: "Loan tiers, guarantors and M-Pesa repayment." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: LoansPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending_guarantors: "Awaiting guarantors",
  pending_approval: "Awaiting approval",
  approved: "Approved",
  disbursing: "Disbursing",
  active: "Active",
  repaid: "Repaid",
  rejected: "Rejected",
  defaulted: "Defaulted",
};

const OPEN_STATUSES = [
  "pending_guarantors",
  "pending_approval",
  "approved",
  "disbursing",
  "active",
  "defaulted",
];

function LoansPage() {
  const { profile, canAccessUserFeatures, isStaff, session } = useAuth();
  const queryClient = useQueryClient();
  const productsFn = useServerFn(listLoanProducts);
  const centerFn = useServerFn(getMyLoanCenter);
  const userGuarantorsFn = useServerFn(listUserGuarantors);
  const submitLoan = useServerFn(requestLoan);
  const respond = useServerFn(respondToGuarantee);
  const receiptFn = useServerFn(getRepaymentReceipt);
  const repaymentsFn = useServerFn(listMyRepayments);
  const envFn = useServerFn(getDarajaEnvironment);

  const navigate = useNavigate();

  const productsQuery = useQuery({
    queryKey: ["loan-products"],
    queryFn: () => productsFn(),
    staleTime: 30000,
    placeholderData: (prev) => prev,
    select: (data) => keysToSnakeCase(data) as KeysToSnakeCase<LoanProduct[]>,
  });

  const centerQuery = useQuery({
    queryKey: ["loan-center"],
    queryFn: () => centerFn(),
    staleTime: 30000,
    placeholderData: (prev) => prev,
    select: (data) =>
      keysToSnakeCase(data) as KeysToSnakeCase<{
        loans: any;

        guaranteeing: any;
      }>,
  });

  const userGuarantorsQuery = useQuery({
    queryKey: ["my-guarantors"],
    queryFn: () => userGuarantorsFn(),
    staleTime: 30000,
    placeholderData: (prev) => prev,
    select: (data) => keysToSnakeCase(data) as KeysToSnakeCase<UserGuarantor[]>,
  });

  const envQuery = useQuery({
    queryKey: ["daraja-env"],
    queryFn: () => envFn(),
    enabled: Boolean(session),
    staleTime: 30_000,
  });

  const isSandbox = envQuery.data?.environment === "sandbox";

  const { businessName } = useAppConfig();
  const activeBusinessName = businessName || "the platform";
  const score = profile?.credibility_score ?? 300;
  const limit = Number(profile?.loan_limit ?? 0);

  const { tab: tabId } = Route.useSearch();
  const [selectedId, setSelectedId] = useState<string | null>(tabId || null);
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [guarantors, setGuarantors] = useState<string[]>(["", ""]);
  const [agreedToLoanTerms, setAgreedToLoanTerms] = useState(false);

  const selected = useMemo(
    () =>
      (productsQuery.data ?? []).find((p) => p.id === selectedId || p.name === selectedId) ?? null,
    [productsQuery.data, selectedId],
  );

  const quote = useMemo(() => {
    const value = Number(amount) || 0;
    if (!selected || value <= 0) return null;
    const interest = Math.round(value * Number(selected.interest_rate));
    const fee = Math.round(value * Number(selected.processing_fee_rate));
    const hasPenalty =
      (selected.custom_penalty_amount !== null &&
        selected.custom_penalty_amount !== undefined &&
        Number(selected.custom_penalty_amount) > 0) ||
      (selected.penalty_rate !== null &&
        selected.penalty_rate !== undefined &&
        Number(selected.penalty_rate) > 0);

    const penaltyRate =
      selected.penalty_rate !== undefined && selected.penalty_rate !== null
        ? Number(selected.penalty_rate)
        : 0;
    const customPenalty =
      selected.custom_penalty_amount !== null && selected.custom_penalty_amount !== undefined
        ? Number(selected.custom_penalty_amount)
        : null;
    const dailyPenalty = hasPenalty
      ? customPenalty && customPenalty > 0
        ? customPenalty
        : Math.max(1, Math.round(interest * penaltyRate))
      : 0;

    return {
      interest,
      fee,
      total: value + interest + fee,
      payout: value - fee,
      dailyPenalty,
      penaltyRate,
      hasPenalty,
    };
  }, [amount, selected]);

  const loans = centerQuery.data?.loans ?? [];
  const guaranteeing = centerQuery.data?.guaranteeing ?? [];

  const defaultedLoan = loans.find(
    (l: any) =>
      (l.status === "defaulted" ||
        (l.status === "active" &&
          l.due_date &&
          new Date(l.due_date) < new Date() &&
          Number(l.amount_repaid) < Number(l.total_due))) &&
      l.status !== "repaid",
  );

  const activeLoan = defaultedLoan || loans.find((l: any) => OPEN_STATUSES.includes(l.status));

  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Choose a loan tier first.");
      if (!agreedToLoanTerms)
        throw new Error("You must accept the Loan Terms & Conditions and Privacy Policy.");
      return submitLoan({
        data: {
          productId: selected.id,
          amount: Number(amount),
          purpose,
          phone,
          guarantors: guarantors.slice(0, selected.guarantors_required),
        },
      });
    },
    onSuccess: () => {
      fireCelebrationConfetti();
      setSelectedId(null);
      setAmount("");
      setPurpose("");
      setAgreedToLoanTerms(false);
      navigate({ to: "/loans", search: (prev) => ({ ...prev, tab: undefined }) });
      void queryClient.invalidateQueries({ queryKey: ["loan-center"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const respondMutation = useMutation({
    mutationFn: (input: { requestId: string; accept: boolean }) => respond({ data: input }),
    onSuccess: () => {
      fireCelebrationConfetti();
      void queryClient.invalidateQueries({ queryKey: ["loan-center"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const repaymentsQuery = useQuery({
    queryKey: ["my-repayments"],
    queryFn: () => repaymentsFn(),
  });

  const prevRepaymentsCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (!repaymentsQuery.data) return;
    const count = repaymentsQuery.data.length;
    if (prevRepaymentsCountRef.current !== null && count > prevRepaymentsCountRef.current) {
      fireCelebrationConfetti();
    }
    prevRepaymentsCountRef.current = count;
  }, [repaymentsQuery.data]);

  const invalidateCenter = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["loan-center"] });
    void queryClient.invalidateQueries({ queryKey: ["my-repayments"] });
    void queryClient.invalidateQueries({ queryKey: ["loan-timeline"] });
  }, [queryClient]);

  const { profile: currentProfile } = useAuth();
  const userId = currentProfile?.id ?? "";
  useRealtimeTable("loans", { column: "user_id", value: userId }, invalidateCenter);
  useRealtimeTable(
    "loan_status_events",
    {
      column: "user_id",
      value: userId,
    },
    invalidateCenter,
  );

  function downloadReceipt(repaymentId: string) {
    receiptFn({ data: { repaymentId } })
      .then((receipt) => {
        if (!receipt) {
          toast.error("Could not generate receipt.");
          return;
        }
        generateReceiptPDF(receipt);
      })
      .catch((error: Error) => toast.error(error.message));
  }

  function selectProduct(id: string, required: number, min: number) {
    setSelectedId(id);
    setAmount(String(min));
    const savedList = userGuarantorsQuery.data ?? [];
    setGuarantors(
      Array.from(
        { length: required },
        (_, i) => savedList[i]?.id_number || savedList[i]?.phone || "",
      ),
    );
  }

  useEffect(() => {
    setSelectedId(tabId ?? null);
  }, [tabId]);

  if (!canAccessUserFeatures && isStaff) {
    return (
      <div className="min-h-screen bg-muted/30">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-4 py-16 text-center space-y-4">
          <h1 className="text-2xl font-bold">Admin Console Only</h1>
          <p className="text-muted-foreground">
            Borrower loan request features are restricted to borrowers and allowed staff agents.
          </p>
          <Button asChild>
            <Link to="/admin">Go to Admin Console</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        {selectedId ? (
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedId(null);
              navigate({ to: "/loans", search: (prev) => ({ ...prev, tab: undefined }) });
            }}
            className="gap-2 -ml-2 mb-2 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Change tier
          </Button>
        ) : (
          <BackButton
            label="Back to Dashboard"
            className="gap-2 text-muted-foreground -ml-2 mb-2"
          />
        )}

        {activeLoan && (
          <Card
            className={cn(
              "mb-10 shadow-soft",
              activeLoan.status === "defaulted"
                ? "border-destructive/60 bg-destructive/10"
                : "border-primary/30 bg-primary/5",
            )}
          >
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5">
              <div>
                <h3
                  className={cn(
                    "font-semibold flex items-center gap-2 text-base",
                    activeLoan.status === "defaulted" ? "text-destructive" : "text-foreground",
                  )}
                >
                  {activeLoan.status === "defaulted" ? (
                    <>
                      <Lock className="size-5 text-destructive" /> Account Locked — Loan Defaulter
                    </>
                  ) : (
                    <>
                      <Wallet className="size-4 text-primary" /> Active Loan in Progress
                    </>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeLoan.status === "defaulted" ? (
                    <>
                      You have an unpaid defaulted loan ({formatKes(Number(activeLoan.principal))}).
                      Your account is locked from requesting or accessing any new loan tiers until
                      your defaulted loan is fully repaid.
                    </>
                  ) : (
                    <>
                      You have an ongoing loan request ({formatKes(Number(activeLoan.principal))})
                      with status{" "}
                      <strong className="text-foreground font-medium">
                        {STATUS_LABEL[activeLoan.status] ?? activeLoan.status}
                      </strong>
                      . Please complete or settle your current loan before applying for a new tier.
                    </>
                  )}
                </p>
              </div>
              {(activeLoan.status === "active" || activeLoan.status === "defaulted") && (
                <RepayLoanDialog
                  loan={activeLoan}
                  trigger={
                    <Button
                      variant={activeLoan.status === "defaulted" ? "destructive" : "gold"}
                      size="sm"
                      className="shrink-0 gap-1.5 font-semibold"
                    >
                      <Wallet className="size-4" />{" "}
                      {activeLoan.status === "defaulted" ? "Repay Defaulted Loan" : "Repay Loan"}
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>
        )}

        {!activeLoan && (
          <div className="mb-10">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-3xl font-semibold"
            >
              {selected ? `${selected.name} Tiers` : "Loan Tiers"}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-1 flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-sm"
            >
              <span>
                Your limit is {formatKes(limit)} with a credibility score of{" "}
                <strong>{score} pts</strong>.
              </span>
              {profile?.is_earning_points_frozen && !isSandbox && (
                <Badge variant="gold" className="gap-1 text-xs">
                  <Lock className="size-3" /> Points Frozen
                </Badge>
              )}
            </motion.div>

            <AnimatePresence mode="wait">
              {!selected ? (
                <motion.section
                  key="tiers"
                  aria-labelledby="tiers"
                  className="mt-8"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {productsQuery.isLoading && (
                      <LucideLoader
                        className="size-5 animate-spin text-primary"
                        aria-label="Loading tiers"
                      />
                    )}
                    {(productsQuery.data ?? []).map((product) => {
                      const eligible =
                        (score >= product.min_credibility && !isSandbox) ||
                        (isSandbox && product.is_test_tier);
                      return (
                        <Card
                          key={product.id}
                          className={cn(
                            "border-border/70 shadow-soft",
                            product.is_test_tier && "border-warning/40 bg-warning/5",
                          )}
                        >
                          <CardHeader>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <CardTitle className="text-base">{product.name}</CardTitle>
                                {product.is_test_tier && (
                                  <Badge
                                    variant="outline"
                                    className="border-warning/40 bg-warning/10 text-gold font-semibold gap-1 text-[11px]"
                                  >
                                    <FlaskConical className="size-3" /> SANDBOX TIER
                                  </Badge>
                                )}
                              </div>
                              {product.is_locked ? (
                                <Badge variant="destructive" className="gap-1 text-[11px]">
                                  <Lock className="size-3" /> Tier Locked
                                </Badge>
                              ) : (
                                <Badge variant={eligible ? "default" : "secondary"}>
                                  {eligible ? "Eligible" : `Score ${product.min_credibility}+`}
                                </Badge>
                              )}
                            </div>
                            <CardDescription>{product.description}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <Row
                              label="Amount"
                              value={`${formatKes(Number(product.min_amount))} – ${formatKes(Number(product.max_amount))}`}
                            />
                            <Row
                              label="Interest"
                              value={`${(Number(product.interest_rate) * 100).toFixed(1)}% per term`}
                            />
                            <Row
                              label="Default fee"
                              value={
                                product.custom_penalty_amount
                                  ? `${formatKes(Number(product.custom_penalty_amount))}/24h`
                                  : product.penalty_rate && Number(product.penalty_rate) > 0
                                    ? `${(Number(product.penalty_rate) * 100).toFixed(0)}% of interest / 24h`
                                    : "No penalty fee"
                              }
                            />
                            <Row label="Term" value={`${product.term_days} days`} />
                            <Row label="Guarantors" value={String(product.guarantors_required)} />
                            <Button
                              className="mt-3 w-full"
                              variant={product.is_locked ? "secondary" : "outline"}
                              disabled={!eligible || product.is_locked}
                              onClick={() => {
                                selectProduct(
                                  product.id,
                                  product.guarantors_required,
                                  Number(product.min_amount),
                                );
                                navigate({
                                  to: "/loans",
                                  search: (prev) => ({ ...prev, tab: product.id }),
                                });
                              }}
                            >
                              {product.is_locked ? "Locked" : "Choose tier"}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </motion.section>
              ) : (
                <motion.div
                  key="request-form"
                  className="mt-8"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <Card className="border-border/70 shadow-soft">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">
                            Request a {selected.name} loan
                          </CardTitle>
                          <CardDescription>
                            {selected.guarantors_required} guarantor(s) must accept before staff
                            review.
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <form
                        className="grid gap-4 md:grid-cols-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          requestMutation.mutate();
                        }}
                      >
                        <div className="space-y-2">
                          <Label htmlFor="amount">Amount (KES)</Label>
                          <Input
                            id="amount"
                            inputMode="numeric"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">M-Pesa phone</Label>
                          <Input
                            id="phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="07XX XXX XXX"
                            required
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="purpose">Purpose</Label>
                          <Textarea
                            id="purpose"
                            value={purpose}
                            maxLength={200}
                            onChange={(e) => setPurpose(e.target.value)}
                            required
                          />
                        </div>
                        {Array.from({ length: selected.guarantors_required }).map((_, index) => {
                          const savedList = userGuarantorsQuery.data ?? [];
                          return (
                            <div className="space-y-2" key={index}>
                              <div className="flex items-center justify-between">
                                <Label htmlFor={`guarantor-${index}`}>Guarantor {index + 1}</Label>
                                {savedList.length > 0 && (
                                  <span className="text-xs text-primary font-medium">
                                    Saved guarantors available
                                  </span>
                                )}
                              </div>
                              <Input
                                id={`guarantor-${index}`}
                                value={guarantors[index] ?? ""}
                                onChange={(e) =>
                                  setGuarantors((prev) => {
                                    const next = [...prev];
                                    next[index] = e.target.value;
                                    return next;
                                  })
                                }
                                placeholder="Phone or ID number"
                                required
                              />
                              {savedList.length > 0 && (
                                <select
                                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                  value={guarantors[index] ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setGuarantors((prev) => {
                                      const next = [...prev];
                                      next[index] = val;
                                      return next;
                                    });
                                  }}
                                >
                                  <option value="">
                                    -- Choose saved guarantor to auto-fill ID --
                                  </option>
                                  {savedList.map((g) => (
                                    <option key={g.id} value={g.id_number || g.phone}>
                                      {g.first_name} {g.last_name} (ID: {g.id_number || g.phone})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          );
                        })}
                        {quote && (
                          <div className="rounded-lg border border-border/70 bg-background p-4 text-sm md:col-span-2 space-y-1">
                            <Row label="Processing fee" value={formatKes(quote.fee)} />
                            <Row label="Interest" value={formatKes(quote.interest)} />
                            <Row label="You receive" value={formatKes(quote.payout)} />
                            <Row label="Total repayable" value={formatKes(quote.total)} />
                            <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground flex items-center justify-between">
                              <span>Default penalty (if overdue):</span>
                              {quote.hasPenalty ? (
                                <span className="font-semibold text-destructive">
                                  +{formatKes(quote.dailyPenalty)} / 24h
                                </span>
                              ) : (
                                <span className="font-medium text-muted-foreground">
                                  No penalty fee
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex items-start gap-2 pt-2 text-sm text-muted-foreground md:col-span-2">
                          <input
                            id="agree-loan-terms"
                            type="checkbox"
                            checked={agreedToLoanTerms}
                            onChange={(e) => setAgreedToLoanTerms(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <label htmlFor="agree-loan-terms" className="leading-snug">
                            I acknowledge that I have read and agree to the{" "}
                            <Link
                              to="/terms"
                              target="_blank"
                              className="font-medium text-primary underline underline-offset-2"
                            >
                              Terms & Conditions
                            </Link>{" "}
                            and{" "}
                            <Link
                              to="/privacy"
                              target="_blank"
                              className="font-medium text-primary underline underline-offset-2"
                            >
                              Privacy Policy
                            </Link>
                            , and I authorize {activeBusinessName} to process this loan request and
                            send M-Pesa repayment prompts.
                          </label>
                        </div>
                        <div className="md:col-span-2">
                          <Button
                            type="submit"
                            size="lg"
                            disabled={requestMutation.isPending || !agreedToLoanTerms}
                          >
                            {requestMutation.isPending ? (
                              <LucideLoader className="animate-spin" />
                            ) : (
                              <Wallet />
                            )}
                            Submit request
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {loans.length !== 0 && (
          <section aria-labelledby="my-loans">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h2 id="my-loans" className="text-3xl font-semibold">
                My loans
              </h2>
              <p className="mt-1 text-muted-foreground">
                Your loans, with a credibility score of {score}.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-4 space-y-4"
            >
              {loans.length === 0 && <p className="text-sm text-muted-foreground">No loans yet.</p>}
              {}
              {loans.map((loan: any) => {
                const outstanding = Number(loan.total_due) - Number(loan.amount_repaid);
                const accepted = (loan.loan_guarantors ?? []).filter(
                  (g: any) => g.status === "accepted",
                ).length;
                return (
                  <Card key={loan.id} className="border-border/70 shadow-soft">
                    <CardHeader>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-base">
                          {loan.loan_products?.name ?? "Loan"} · {formatKes(Number(loan.principal))}
                        </CardTitle>
                        <Badge
                          variant={
                            loan.status === "active"
                              ? "default"
                              : loan.status === "rejected"
                                ? "destructive"
                                : loan.status.includes("pending")
                                  ? "gold"
                                  : loan.status === "defaulted"
                                    ? "gray"
                                    : "secondary"
                          }
                        >
                          {STATUS_LABEL[loan.status] ?? loan.status}
                        </Badge>
                      </div>
                      <CardDescription>{loan.purpose}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <Row label="Total repayable" value={formatKes(Number(loan.total_due))} />
                      {Number(loan.penalty_amount || 0) > 0 && (
                        <div className="flex items-center justify-between py-1 px-2 rounded bg-destructive/10 text-xs text-destructive font-medium">
                          <span>
                            Default penalty ({loan.penalty_count || 1} x 24h cycle
                            {(loan.penalty_count || 1) > 1 ? "s" : ""})
                          </span>
                          <span className="font-bold">
                            +{formatKes(Number(loan.penalty_amount))}
                          </span>
                        </div>
                      )}
                      <Row label="Amount repaid" value={formatKes(Number(loan.amount_repaid))} />
                      <Row label="Outstanding" value={formatKes(Math.max(0, outstanding))} />
                      <LoanCardDeadline
                        dueDateStr={loan.due_date}
                        status={loan.status}
                        isRepaid={loan.status === "repaid" || outstanding <= 0}
                      />
                      <Row
                        label="Guarantors accepted"
                        value={`${accepted}/${loan.guarantors_required}`}
                      />
                      {loan.rejection_reason && (
                        <p className="text-destructive">{loan.rejection_reason}</p>
                      )}
                      {(loan.status === "active" || loan.status === "defaulted") && (
                        <div className="pt-2 flex flex-wrap items-center gap-2">
                          <RepayLoanDialog
                            loan={loan}
                            trigger={
                              <Button variant="gold" size="sm" className="gap-2 font-medium">
                                <Wallet className="size-4" />
                                Repay Loan ({formatKes(Math.max(0, outstanding))})
                              </Button>
                            }
                          />
                        </div>
                      )}
                      <details
                        open={
                          loan.status === "active" ||
                          loan.status === "defaulted" ||
                          loan.status.includes("pending")
                        }
                        className="group pt-3"
                      >
                        <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors">
                          <History className="size-3.5 text-primary" />
                          Loan Status Timeline
                        </summary>
                        <div className="mt-3">
                          <LoanTimeline loanId={loan.id} />
                        </div>
                      </details>
                    </CardContent>
                  </Card>
                );
              })}
            </motion.div>
          </section>
        )}

        <section aria-labelledby="guaranteeing" className="mt-10">
          <h2 id="guaranteeing" className="text-xl font-semibold">
            Guarantor requests
          </h2>
          <div className="mt-4 space-y-4">
            {guaranteeing.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nobody has asked you to guarantee yet.
              </p>
            )}
            {}
            {guaranteeing.map((item: any) => (
              <Card key={item.id} className="border-border/70 shadow-soft">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldCheck className="size-4 text-primary" aria-hidden />
                      {formatKes(Number(item.loans?.principal ?? 0))} request
                    </CardTitle>
                    <Badge variant={item.status === "pending" ? "secondary" : "default"}>
                      {item.status}
                    </Badge>
                  </div>
                  <CardDescription>{item.loans?.purpose}</CardDescription>
                </CardHeader>
                {item.status === "pending" && (
                  <CardContent className="flex gap-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          disabled={respondMutation.isPending}
                          onClick={() =>
                            respondMutation.mutate({ requestId: item.id, accept: true })
                          }
                        >
                          <Check /> Accept
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Agree to serve as a guarantor for this loan application
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={respondMutation.isPending}
                          onClick={() =>
                            respondMutation.mutate({ requestId: item.id, accept: false })
                          }
                        >
                          <X /> Decline
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Decline this loan guarantee request
                      </TooltipContent>
                    </Tooltip>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </section>

        {repaymentsQuery.data && repaymentsQuery.data.length !== 0 && (
          <section aria-label="Repayment receipts" className="mt-10">
            <h2 className="text-lg font-semibold">Repayment receipts</h2>
            <p className="text-sm text-muted-foreground">
              Download a PDF receipt for any repayment you've made.
            </p>
            <div className="mt-4 space-y-3">
              {(repaymentsQuery.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No repayments yet.</p>
              )}
              {(repaymentsQuery.data ?? []).map(
                (repayment: {
                  id: string;
                  loan_id: string;
                  amount: string;
                  mpesa_receipt: string | null;
                  created_at: string;
                  loans: { id: string; principal: string; total_due: string } | null;
                }) => (
                  <Card key={repayment.id} className="border-border/70 shadow-soft">
                    <CardContent className="flex items-center justify-between gap-4 py-4">
                      <div>
                        <p className="font-medium">{formatKes(Number(repayment.amount))}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(repayment.created_at).toLocaleDateString("en-KE", {
                            dateStyle: "medium",
                          })}
                          {repayment.mpesa_receipt ? ` · M-Pesa ${repayment.mpesa_receipt}` : ""}
                        </p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadReceipt(repayment.id)}
                          >
                            <Download className="size-4" /> Receipt
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Generate and download a PDF payment receipt with M-Pesa reference
                        </TooltipContent>
                      </Tooltip>
                    </CardContent>
                  </Card>
                ),
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}

function LoanCardDeadline({
  dueDateStr,
  status,
  isRepaid = false,
}: {
  dueDateStr?: string | null;
  status?: string;
  isRepaid?: boolean;
}) {
  const isRunning = (status === "active" || status === "defaulted") && !isRepaid;
  const dueInfo = useRealtimeDeadline(dueDateStr, isRepaid, !isRunning);

  if (isRepaid || status === "repaid") {
    return <Row label="Loan deadline" value="Fully Repaid" />;
  }

  if (status === "rejected") {
    return <Row label="Loan deadline" value="Request Rejected" />;
  }

  if (status === "cancelled") {
    return <Row label="Loan deadline" value="Loan Cancelled" />;
  }

  if (!isRunning) {
    return <Row label="Loan deadline" value="Starts upon disbursement" />;
  }

  if (!dueDateStr) {
    return <Row label="Loan deadline" value="Awaiting disbursement" />;
  }

  return (
    <>
      <Row label="Loan deadline" value={dueInfo.fullDeadlineText} />
      <Row label="Time to deadline" value={dueInfo.daysText} />
    </>
  );
}
