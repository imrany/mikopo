import { createServerFn } from "@tanstack/react-start";
import { requireCustomAuth } from "./auth-middleware";
import { prisma } from "./prisma";

export const getReferralData = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    try {
      const { userId } = context;

      const profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: {
          id: true,
          referralCode: true,
          credibilityScore: true,
          isEarningPointsFrozen: true,
        },
      });

      if (!profile) throw new Error("Profile not found");

      const referees = await prisma.profile.findMany({
        where: { referredBy: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          createdAt: true,
          loans: {
            where: { status: "repaid" },
            select: { id: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const rewards = await prisma.referralReward.findMany({
        where: { referrerId: userId },
        select: {
          id: true,
          referredId: true,
          scoreAwarded: true,
          createdAt: true,
        },
      });

      const totalRewardsPoints = rewards.reduce((sum, r) => sum + r.scoreAwarded, 0);

      const refereesFormatted = referees.map((ref) => {
        const hasRepaidLoan = ref.loans.length > 0;
        const rewardEntry = rewards.find((r) => r.referredId === ref.id);
        const maskedEmail = ref.email
          ? ref.email.replace(/^(.{2})(.*)(@.*)$/, "$1***$3")
          : "Hidden";

        return {
          id: ref.id,
          name: `${ref.firstName} ${ref.lastName}`.trim() || "Member",
          email: maskedEmail,
          joinedAt: ref.createdAt.toISOString(),
          hasRepaidLoan,
          pointsEarned: rewardEntry ? rewardEntry.scoreAwarded : hasRepaidLoan ? 5 : 0,
        };
      });

      const { getActiveEnvironment } = await import("./loans.server");
      const environment = await getActiveEnvironment();
      const isSandbox = environment === "sandbox";

      return {
        referralCode: profile.referralCode,
        currentScore: profile.credibilityScore,
        isFrozen: Boolean(profile.isEarningPointsFrozen || isSandbox),
        isSandbox,
        totalReferees: referees.length,
        totalPointsEarned: totalRewardsPoints,
        referees: refereesFormatted,
      };
    } catch (err) {
      console.error("[getReferralData error]:", err);
      throw err;
    }
  });
