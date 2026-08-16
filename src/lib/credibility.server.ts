import { prisma } from "./prisma";

/** Helper to calculate loan limit corresponding to a given credibility score (pts) */
export async function calculateLoanLimitForScore(score: number): Promise<number> {
  const products = await prisma.loanProduct.findMany({
    where: { isActive: true },
    orderBy: { minCredibility: "asc" },
  });

  const eligibleProducts = products.filter((p) => p.minCredibility <= score);
  if (eligibleProducts.length > 0) {
    const highestProduct = eligibleProducts[eligibleProducts.length - 1];
    return Number(highestProduct.maxAmount);
  }

  return 1000;
}

export async function getUserPointsFrozenState(userId: string): Promise<{
  isFrozen: boolean;
  isSandbox: boolean;
  hasDefaultedLoan: boolean;
  isAdminFrozen: boolean;
  reason: string | null;
}> {
  const { getActiveEnvironment } = await import("./loans.server");
  const [env, profile, defaultedLoan] = await Promise.all([
    getActiveEnvironment(),
    prisma.profile.findUnique({
      where: { id: userId },
      select: { isEarningPointsFrozen: true },
    }),
    prisma.loan.findFirst({
      where: { userId, status: "defaulted" },
      select: { id: true },
    }),
  ]);

  const isSandbox = env === "sandbox";
  const hasDefaultedLoan = Boolean(defaultedLoan);
  const isAdminFrozen = Boolean(profile?.isEarningPointsFrozen);
  const isFrozen = isSandbox || hasDefaultedLoan || isAdminFrozen;

  let reason: string | null = null;
  if (isSandbox) {
    reason = "Points earning is frozen in Sandbox Mode.";
  } else if (hasDefaultedLoan) {
    reason =
      "Points earning is frozen due to a defaulted loan. Repay your loan to restore credibility progress.";
  } else if (isAdminFrozen) {
    reason = "Points earning has been frozen by administration.";
  }

  return {
    isFrozen,
    isSandbox,
    hasDefaultedLoan,
    isAdminFrozen,
    reason,
  };
}

/** Synchronize user credibility score based on verified guarantors, loan repayments, testimonials, and referrals */
export async function syncUserCredibilityScore(userId: string): Promise<number> {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true, credibilityScore: true, loanLimit: true, isEarningPointsFrozen: true },
  });

  if (!profile) return 300;

  // Admins and staff agents never have credibility points or loan limits
  const userRoles = await prisma.userRole.findMany({ where: { userId }, select: { role: true } });
  const isAdminOrStaff = userRoles.some((r) => r.role === "super_admin" || r.role === "staff");
  if (isAdminOrStaff) {
    if (profile.credibilityScore !== 0 || Number(profile.loanLimit) !== 0) {
      await prisma.profile.update({
        where: { id: userId },
        data: { credibilityScore: 0, loanLimit: 0 },
      });
    }
    return 0;
  }

  const { getActiveEnvironment } = await import("./loans.server");
  const env = await getActiveEnvironment();
  // Points are frozen in sandbox mode
  if (env === "sandbox") {
    return profile.credibilityScore;
  }

  // Points are frozen if admin/agent/initial admin froze points
  if (profile.isEarningPointsFrozen) {
    return profile.credibilityScore;
  }

  // Points are frozen if user defaults a loan
  const hasDefaultedLoan = await prisma.loan.findFirst({
    where: { userId, status: "defaulted" },
    select: { id: true },
  });
  if (hasDefaultedLoan) {
    return profile.credibilityScore;
  }

  const [
    repaidLoansCount,
    userGuarantorsCount,
    acceptedLoanGuarantorsCount,
    approvedTestimonialsCount,
    referralRewards,
  ] = await Promise.all([
    prisma.loan.count({ where: { userId, status: "repaid" } }),
    prisma.userGuarantor.count({ where: { userId } }),
    prisma.loanGuarantor.count({ where: { loan: { userId }, status: "accepted" } }),
    prisma.testimonial.count({ where: { userId, status: "approved" } }),
    prisma.referralReward.aggregate({
      where: { referrerId: userId },
      _sum: { scoreAwarded: true },
    }),
  ]);

  const totalGuarantorsCount = Math.max(userGuarantorsCount, acceptedLoanGuarantorsCount);
  const guarantorPoints = Math.min(30, totalGuarantorsCount * 5);
  const testimonialPoints = approvedTestimonialsCount * 5;
  const repaidPoints = repaidLoansCount * 10;
  const referralPoints = referralRewards._sum.scoreAwarded ?? 0;

  const baseScore = 300;
  const targetScore = Math.min(
    850,
    baseScore + repaidPoints + guarantorPoints + testimonialPoints + referralPoints,
  );

  const targetLimit = await calculateLoanLimitForScore(targetScore);

  if (!profile.isEarningPointsFrozen) {
    const scoreToSet = Math.max(profile.credibilityScore, targetScore);
    const limitToSet = Math.max(Number(profile.loanLimit), targetLimit);

    if (profile.credibilityScore !== scoreToSet || Number(profile.loanLimit) !== limitToSet) {
      await prisma.profile.update({
        where: { id: userId },
        data: {
          credibilityScore: scoreToSet,
          loanLimit: limitToSet,
        },
      });
      return scoreToSet;
    }
  }

  return profile.credibilityScore;
}
