import { createServerFn } from "@tanstack/react-start";
import { requireCustomAuth } from "./auth-middleware";
import { prisma } from "./prisma";
import { syncUserCredibilityScore, getUserPointsFrozenState } from "./credibility.server";

export const getCredibilityData = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    try {
      const { userId, roles = [] } = context;
      const isAdminOrStaff = roles.includes("super_admin") || roles.includes("staff");

      // Auto-sync credibility score so verified guarantors, repayments, testimonials increase points
      const syncedScore = await syncUserCredibilityScore(userId);
      const frozenState = await getUserPointsFrozenState(userId);

      const profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: {
          id: true,
          credibilityScore: true,
          loanLimit: true,
          isEarningPointsFrozen: true,
          createdAt: true,
        },
      });

      if (!profile) throw new Error("Profile not found");

      const [
        repaidLoansCount,
        activeLoansCount,
        defaultedLoansCount,
        userGuarantorsCount,
        acceptedLoanGuarantorsCount,
        approvedTestimonialsCount,
        refereesCount,
        referralRewards,
        settings,
      ] = await Promise.all([
        prisma.loan.count({ where: { userId, status: "repaid" } }),
        prisma.loan.count({ where: { userId, status: "active" } }),
        prisma.loan.count({ where: { userId, status: "defaulted" } }),
        prisma.userGuarantor.count({ where: { userId } }),
        prisma.loanGuarantor.count({ where: { loan: { userId }, status: "accepted" } }),
        prisma.testimonial.count({ where: { userId, status: "approved" } }),
        prisma.profile.count({ where: { referredBy: userId } }),
        prisma.referralReward.aggregate({
          where: { referrerId: userId },
          _sum: { scoreAwarded: true },
        }),
        prisma.businessSettings.findFirst({
          select: { minCredibilityScore: true, maxCredibilityScore: true },
        }),
      ]);

      const totalGuarantors = Math.max(userGuarantorsCount, acceptedLoanGuarantorsCount);
      const referralPoints = referralRewards._sum.scoreAwarded ?? 0;
      const repaidPoints = repaidLoansCount * 10;
      const guarantorPoints = Math.min(30, totalGuarantors * 5);
      const testimonialPoints = approvedTestimonialsCount * 5;

      const products = await prisma.loanProduct.findMany({
        where: { isActive: true },
        orderBy: { minCredibility: "asc" },
      });

      return {
        score: isAdminOrStaff ? 0 : Math.max(syncedScore, profile.credibilityScore),
        loanLimit: isAdminOrStaff ? 0 : Number(profile.loanLimit),
        isFrozen: frozenState.isFrozen,
        frozenReason: frozenState.reason,
        isSandbox: frozenState.isSandbox,
        hasDefaultedLoan: frozenState.hasDefaultedLoan,
        isAdminFrozen: frozenState.isAdminFrozen,
        memberSince: profile.createdAt.toISOString(),
        minScore: settings?.minCredibilityScore ?? 0,
        maxScore: settings?.maxCredibilityScore ?? 1000,
        stats: {
          repaidLoansCount,
          activeLoansCount,
          defaultedLoansCount,
          guarantorsCount: totalGuarantors,
          testimonialsCount: approvedTestimonialsCount,
          refereesCount,
          referralPoints,
          repaidPoints,
          guarantorPoints,
          testimonialPoints,
        },
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          minCredibility: p.minCredibility,
          minAmount: Number(p.minAmount),
          maxAmount: Number(p.maxAmount),
          description: p.description,
          isTestTier: Boolean(p.isTestTier),
        })),
      };
    } catch (err) {
      console.error("[getCredibilityData error]:", err);
      throw err;
    }
  });
