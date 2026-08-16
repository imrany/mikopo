import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Banknote, Calculator, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatKes } from "@/lib/format";
import { listPublicLoanProducts } from "@/lib/loans.functions";

export function LoanCalculator({ businessName }: { businessName: string }) {
  const getProductsFn = useServerFn(listPublicLoanProducts);
  const { data: dbProducts } = useQuery({
    queryKey: ["public-loan-products"],
    queryFn: () => getProductsFn(),
    staleTime: 5 * 60 * 1000,
  });

  const tiers =
    dbProducts && dbProducts.length > 0
      ? dbProducts.map((p: any) => ({
          name: p.name,
          min: p.min_amount,
          max: p.max_amount,
          rate: p.interest_rate,
          fee: p.processing_fee_rate,
          penaltyRate: p.penalty_rate,
          customPenaltyAmount: p.custom_penalty_amount ?? null,
          days: p.term_days,
          guarantors: p.guarantors_required,
          minCredibility: p.min_credibility,
        }))
      : null;

  const [selectedTierIndex, setSelectedTierIndex] = useState(0);
  const activeIndex = selectedTierIndex < (tiers?.length ?? 0) ? selectedTierIndex : 0;
  const currentTier = tiers?.[activeIndex];
  const [amount, setAmount] = useState<number>(300);

  const handleTierChange = (index: number) => {
    setSelectedTierIndex(index);
    const tier = tiers?.[index];
    if (amount < (tier?.min ?? 0) || amount > (tier?.max ?? 0)) {
      setAmount(Math.round((tier?.min ?? 0) + (tier?.max ?? 0) / 2));
    }
  };

  const interestAmount = Math.round(amount * (currentTier?.rate ?? 0));
  const feeAmount = Math.round(amount * (currentTier?.fee ?? 0));
  const totalRepayable = amount + interestAmount + feeAmount;

  const hasPenaltyRule =
    currentTier &&
    ((currentTier.customPenaltyAmount !== null &&
      currentTier.customPenaltyAmount !== undefined &&
      Number(currentTier.customPenaltyAmount) > 0) ||
      (currentTier.penaltyRate !== null &&
        currentTier.penaltyRate !== undefined &&
        Number(currentTier.penaltyRate) > 0));

  const dailyPenaltyAmount = hasPenaltyRule
    ? currentTier.customPenaltyAmount && Number(currentTier.customPenaltyAmount) > 0
      ? Number(currentTier.customPenaltyAmount)
      : Math.max(1, Math.round(interestAmount * Number(currentTier.penaltyRate)))
    : 0;

  return (
    <Card className="border-border/80 bg-gradient-surface shadow-lift overflow-hidden">
      <CardHeader className="bg-primary/5 border-b border-border/50 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-primary/10 text-primary">
              <Calculator className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base font-semibold">Instant Loan Estimator</CardTitle>
              <CardDescription className="text-xs">
                Calculate repayment schedules and fees for {businessName}
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="hidden sm:inline-flex gap-1 text-xs">
            <ShieldCheck className="size-3 text-primary" /> M-Pesa Disbursed
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Tier Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Select Credit Tier
          </label>
          <div className="flex flex-wrap gap-1.5 p-1 bg-muted/60 rounded-xl">
            {tiers &&
              tiers.map((tier: any, idx: any) => (
                <button
                  key={tier?.name}
                  type="button"
                  onClick={() => handleTierChange(idx)}
                  className={`flex-1 min-w-17.5 py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                    activeIndex === idx
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tier?.name}
                </button>
              ))}
          </div>
        </div>

        {/* Amount Slider */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
              Loan Principal Amount
            </span>
            <span className="font-display text-xl font-bold text-primary">{formatKes(amount)}</span>
          </div>

          <Slider
            value={[amount]}
            min={currentTier?.min}
            max={currentTier?.max}
            step={100}
            onValueChange={(val) => setAmount(val[0] || currentTier?.min)}
            className="py-2"
          />

          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Min: {formatKes(currentTier?.min)}</span>
            <span>Max: {formatKes(currentTier?.max)}</span>
          </div>
        </div>

        {/* Calculation Summary Table */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-muted/40 rounded-xl border border-border/60">
          <div>
            <p className="text-[11px] text-muted-foreground">Repayment Term</p>
            <p className="text-sm font-semibold mt-0.5">{currentTier?.days} Days</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">
              Interest ({Math.round(currentTier?.rate * 100)}%)
            </p>
            <p className="text-sm font-semibold mt-0.5">{formatKes(interestAmount)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">
              Processing Fee ({Math.round(currentTier?.fee * 100)}%)
            </p>
            <p className="text-sm font-semibold mt-0.5">{formatKes(feeAmount)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Required Guarantors</p>
            <p className="text-sm font-semibold mt-0.5 text-primary">
              {currentTier?.guarantors} Guarantors
            </p>
          </div>
        </div>

        {/* 24-Hour Default Penalty Notice */}
        {hasPenaltyRule ? (
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
            <span className="font-semibold">Default Penalty (Every 24h overdue):</span>
            <span className="font-bold font-display">+{formatKes(dailyPenaltyAmount)} / 24h</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs text-muted-foreground">
            <span className="font-semibold">Default Penalty:</span>
            <span className="font-medium">No penalty fee</span>
          </div>
        )}

        {/* Total Repayable Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-gradient-brand text-primary-foreground shadow-md">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-primary-foreground/15">
              <Banknote className="size-6" />
            </span>
            <div>
              <p className="text-xs text-primary-foreground/80 font-medium">
                Total Repayable Amount
              </p>
              <p className="text-2xl font-bold font-display">{formatKes(totalRepayable)}</p>
            </div>
          </div>

          <Button variant="gold" size="lg" asChild className="w-full sm:w-auto shrink-0 shadow-sm">
            <Link
              to="/loans"
              search={{ tab: currentTier?.name.toLowerCase().replace(/\s+/g, "_") }}
            >
              Apply for {formatKes(amount)}
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-1">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="size-3.5 text-success" /> Instant M-Pesa B2C
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="size-3.5 text-success" /> 1-Tap STK Repay
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="size-3.5 text-success" /> Zero Hidden Charges
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
