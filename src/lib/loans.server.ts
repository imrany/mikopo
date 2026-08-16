import { prisma } from "@/lib/prisma";
import { normalizePhone } from "./format";
import {
  buildConfig,
  hasDbCredentials,
  loadDarajaCredentials,
  readEnvConfig,
  type MpesaConfig,
} from "./mpesa.server";

export interface LoanQuote {
  principal: number;
  interestAmount: number;
  processingFee: number;
  totalDue: number;
  dueDate: string;
  penaltyRate: number;
  dailyPenaltyAmount: number;
}

export function calculateDailyDefaultPenalty(
  product?: { penaltyRate?: unknown; customPenaltyAmount?: unknown; interestRate?: unknown } | null,
  principal = 0,
  interestAmount?: number,
): number {
  if (
    product?.customPenaltyAmount !== undefined &&
    product?.customPenaltyAmount !== null &&
    Number(product.customPenaltyAmount) > 0
  ) {
    return Math.max(1, Math.round(Number(product.customPenaltyAmount)));
  }

  // If penalty rate is explicitly null, undefined, or <= 0, then no penalty applies
  if (
    product?.penaltyRate === undefined ||
    product?.penaltyRate === null ||
    Number(product.penaltyRate) <= 0
  ) {
    return 0;
  }

  const rate = Number(product.penaltyRate);
  const interest =
    interestAmount !== undefined
      ? interestAmount
      : Math.round(principal * Number(product?.interestRate || 0.1));

  const calculatedDailyPenalty = Math.round(interest * rate);
  return Math.max(1, calculatedDailyPenalty);
}

export function quoteLoan(
  product: {
    interestRate: unknown;
    processingFeeRate: unknown;
    termDays: number;
    penaltyRate?: unknown;
    customPenaltyAmount?: unknown;
  },
  principal: number,
): LoanQuote {
  const interestAmount = Math.round(principal * Number(product.interestRate));
  const processingFee = Math.round(principal * Number(product.processingFeeRate));
  const due = new Date();
  due.setUTCDate(due.getUTCDate() + product.termDays);

  const penaltyRate =
    product.penaltyRate !== undefined && product.penaltyRate !== null
      ? Number(product.penaltyRate)
      : 0;
  const dailyPenaltyAmount = calculateDailyDefaultPenalty(product, principal, interestAmount);

  return {
    principal,
    interestAmount,
    processingFee,
    totalDue: principal + interestAmount + processingFee,
    dueDate: due.toISOString().slice(0, 10),
    penaltyRate,
    dailyPenaltyAmount,
  };
}

/** Resolves guarantor identifiers (phone or national ID) to member ids or saved guarantors. */
export async function resolveGuarantors(identifiers: string[], borrowerId: string) {
  const resolved: {
    id?: string;
    label: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    idNumber?: string;
    relationship?: string;
    occupation?: string;
    address?: string;
  }[] = [];

  for (const raw of identifiers) {
    const value = raw.trim();
    if (!value) continue;
    const digits = value.replace(/\D/g, "");
    const phone = normalizePhone(value);

    // 1. Check if identifier belongs to a registered Profile user
    const profile = await prisma.profile.findFirst({
      where: {
        OR: [{ phone }, { idNumber: digits }],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        idNumber: true,
        status: true,
      },
    });

    if (profile) {
      if (profile.id === borrowerId) throw new Error("You cannot guarantee your own loan.");
      if (profile.status !== "active")
        throw new Error(`${profile.firstName} is not an active member.`);
      if (resolved.some((r) => r.id === profile.id))
        throw new Error("Guarantors must be different people.");

      resolved.push({
        id: profile.id,
        label: `${profile.firstName} ${profile.lastName}`.trim(),
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone ?? "",
        idNumber: profile.idNumber ?? "",
      });
      continue;
    }

    // 2. Check if identifier belongs to a saved UserGuarantor for this borrower
    const userGuarantor = await prisma.userGuarantor.findFirst({
      where: {
        userId: borrowerId,
        OR: [{ idNumber: digits }, { phone }],
      },
    });

    if (userGuarantor) {
      if (
        resolved.some(
          (r) =>
            (r.idNumber && r.idNumber === userGuarantor.idNumber) ||
            (r.phone && r.phone === userGuarantor.phone),
        )
      ) {
        throw new Error("Guarantors must be different people.");
      }
      resolved.push({
        label: `${userGuarantor.firstName} ${userGuarantor.lastName}`.trim(),
        firstName: userGuarantor.firstName,
        lastName: userGuarantor.lastName,
        phone: userGuarantor.phone,
        idNumber: userGuarantor.idNumber,
        relationship: userGuarantor.relationship,
        occupation: userGuarantor.occupation,
        address: userGuarantor.address,
      });
      continue;
    }

    throw new Error(`No member or registered guarantor found for "${value}".`);
  }
  return resolved;
}

export async function loadMpesaConfig(callbackBase: string): Promise<MpesaConfig> {
  const settings = await prisma.businessSettings.findFirst({
    select: { mpesaShortcode: true, mpesaEnvironment: true, mpesaCallbackUrl: true },
  });
  if (!settings) throw new Error("Business setup is not complete yet.");

  const daraja = await loadDarajaCredentials();
  if (hasDbCredentials(daraja)) {
    return buildConfig(daraja!, {
      environment: daraja!.environment,
      shortcode: settings.mpesaShortcode || "",
      callbackBase: settings.mpesaCallbackUrl || callbackBase,
    });
  }
  return readEnvConfig({
    environment: settings.mpesaEnvironment,
    shortcode: settings.mpesaShortcode,
    callbackBase: settings.mpesaCallbackUrl || callbackBase,
  });
}

export async function getActiveEnvironment(): Promise<"sandbox" | "production"> {
  const daraja = await loadDarajaCredentials();
  if (daraja?.environment === "production") {
    return "production";
  }
  return "sandbox";
}

export async function assertStaff(userId: string) {
  const roles = await prisma.userRole.findMany({
    where: { userId, role: { in: ["super_admin", "staff"] } },
  });
  if (roles.length === 0) throw new Error("Forbidden");
}

export async function assertAdmin(userId: string) {
  await assertStaff(userId);
}

export async function ensureLoanProductsSeeded() {
  const environment = await getActiveEnvironment();

  // Rename any legacy "Sandbox Test Tier" or similar to "Sandbox Tier"
  await prisma.loanProduct.updateMany({
    where: {
      OR: [{ name: { contains: "Sandbox Test" } }, { name: { contains: "Sandbox Test Tier" } }],
    },
    data: { name: "Sandbox Tier" },
  });

  if (environment === "sandbox") {
    const sandboxTier = await prisma.loanProduct.findFirst({
      where: { isTestTier: true },
    });

    if (!sandboxTier) {
      await prisma.loanProduct.create({
        data: {
          name: "Sandbox Tier",
          description: "Small loan tier for M-Pesa sandbox testing (KES 1-10)",
          minAmount: 1,
          maxAmount: 10,
          interestRate: 0.01,
          processingFeeRate: 0,
          termDays: 1,
          penaltyRate: 0.25,
          minCredibility: 0,
          guarantorsRequired: 0,
          sortOrder: 0,
          isActive: true,
          isTestTier: true,
        },
      });
    }
  }

  const count = await prisma.loanProduct.count();
  if (count > 0) return;

  const defaultProducts = [
    {
      name: "Starter",
      description: "First-time borrowers building a track record.",
      minAmount: 500,
      maxAmount: 2000,
      interestRate: 0.12,
      processingFeeRate: 0.02,
      penaltyRate: 0.25,
      termDays: 14,
      minCredibility: 300,
      guarantorsRequired: 2,
      sortOrder: 1,
    },
    {
      name: "Bronze",
      description: "Short-term cash for everyday needs.",
      minAmount: 2000,
      maxAmount: 5000,
      interestRate: 0.11,
      processingFeeRate: 0.02,
      penaltyRate: 0.25,
      termDays: 30,
      minCredibility: 400,
      guarantorsRequired: 2,
      sortOrder: 2,
    },
    {
      name: "Silver",
      description: "Bigger limits for consistent repayers.",
      minAmount: 5001,
      maxAmount: 15000,
      interestRate: 0.1,
      processingFeeRate: 0.015,
      penaltyRate: 0.25,
      termDays: 45,
      minCredibility: 550,
      guarantorsRequired: 2,
      sortOrder: 3,
    },
    {
      name: "Gold",
      description: "Business boost loans with lower rates.",
      minAmount: 15000,
      maxAmount: 40000,
      interestRate: 0.08,
      processingFeeRate: 0.015,
      penaltyRate: 0.25,
      termDays: 60,
      minCredibility: 700,
      guarantorsRequired: 2,
      sortOrder: 4,
    },
    {
      name: "Platinum",
      description: "Premium tier for our most trusted members.",
      minAmount: 40000,
      maxAmount: 100000,
      interestRate: 0.06,
      processingFeeRate: 0.01,
      penaltyRate: 0.25,
      termDays: 90,
      minCredibility: 850,
      guarantorsRequired: 3,
      sortOrder: 5,
    },
  ];

  for (const product of defaultProducts) {
    await prisma.loanProduct.upsert({
      where: { name: product.name },
      create: product,
      update: product,
    });
  }
}

export async function recalcLoanAfterRepayment(loanId: string) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: { id: true, totalDue: true, amountRepaid: true, userId: true, status: true },
  });
  if (!loan) return;

  if (Number(loan.amountRepaid) >= Number(loan.totalDue) && loan.status !== "repaid") {
    const prevStatus = loan.status;
    await prisma.loan.update({
      where: { id: loanId },
      data: { status: "repaid", repaidAt: new Date() },
    });

    await prisma.loanStatusEvent.create({
      data: {
        loanId,
        status: "repaid",
        previousStatus: prevStatus,
        note: "Loan fully repaid.",
      },
    });

    const profile = await prisma.profile.findUnique({
      where: { id: loan.userId },
      select: { credibilityScore: true, loanLimit: true, isEarningPointsFrozen: true },
    });

    if (profile) {
      const addedPoints = profile.isEarningPointsFrozen ? 0 : 10;
      const newScore = Math.min(850, profile.credibilityScore + addedPoints);
      const { calculateLoanLimitForScore } = await import("./credibility.server");
      const newLimit = await calculateLoanLimitForScore(newScore);
      await prisma.profile.update({
        where: { id: loan.userId },
        data: {
          credibilityScore: newScore,
          loanLimit: newLimit,
        },
      });
    }
    await awardReferralBonus(loanId);
  }
}

export async function reconcileOverdueLoans() {
  try {
    const now = new Date();
    // 1. Transition active/disbursed loans that have passed due date to defaulted
    const newlyOverdueLoans = await prisma.loan.findMany({
      where: {
        status: { in: ["active", "disbursed"] },
        dueDate: {
          lt: now,
        },
      },
      select: {
        id: true,
        totalDue: true,
        amountRepaid: true,
        userId: true,
        dueDate: true,
      },
    });

    for (const loan of newlyOverdueLoans) {
      if (Number(loan.amountRepaid) < Number(loan.totalDue)) {
        await prisma.loan.update({
          where: { id: loan.id },
          data: {
            status: "defaulted",
            lastPenaltyAppliedAt: loan.dueDate || now,
          },
        });

        await prisma.loanStatusEvent.create({
          data: {
            loanId: loan.id,
            status: "defaulted",
            previousStatus: "active",
            note: "Loan repayment term expired with outstanding balance; loan marked as defaulted. 24-hour default penalty fee schedule started.",
          },
        });

        await prisma.auditLog.create({
          data: {
            action: "loan.defaulted",
            targetType: "loan",
            targetId: loan.id,
            details: {
              reason: "Repayment deadline passed with outstanding balance.",
              previousStatus: "active",
              newStatus: "defaulted",
            },
          },
        });
      }
    }

    // 2. Accrue 24-hour default penalties for all unpaid defaulted loans
    const defaultedLoans = await prisma.loan.findMany({
      where: {
        status: "defaulted",
      },
      include: {
        product: true,
      },
    });

    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    for (const loan of defaultedLoans) {
      const outstanding = Number(loan.totalDue) - Number(loan.amountRepaid);
      if (outstanding <= 0) continue;

      // Base time anchor: lastPenaltyAppliedAt, or dueDate, or createdAt
      const baseline = loan.lastPenaltyAppliedAt
        ? new Date(loan.lastPenaltyAppliedAt)
        : loan.dueDate
          ? new Date(loan.dueDate)
          : new Date(loan.createdAt);

      const diffMs = now.getTime() - baseline.getTime();
      const intervalsPassed = Math.floor(diffMs / MS_PER_DAY);

      if (intervalsPassed >= 1) {
        const dailyPenalty = calculateDailyDefaultPenalty(
          loan.product,
          Number(loan.principal),
          Number(loan.interestAmount),
        );
        const newLastPenaltyAppliedAt = new Date(baseline.getTime() + intervalsPassed * MS_PER_DAY);

        if (dailyPenalty > 0) {
          const penaltyToAdd = dailyPenalty * intervalsPassed;
          const currentPenaltyAmount = Number(loan.penaltyAmount || 0);
          const newPenaltyAmount = currentPenaltyAmount + penaltyToAdd;

          const basePrincipalFee =
            Number(loan.principal) + Number(loan.interestAmount) + Number(loan.processingFee);
          const newTotalDue = basePrincipalFee + newPenaltyAmount;
          const newPenaltyCount = (loan.penaltyCount || 0) + intervalsPassed;

          await prisma.loan.update({
            where: { id: loan.id },
            data: {
              penaltyAmount: newPenaltyAmount,
              totalDue: newTotalDue,
              penaltyCount: newPenaltyCount,
              lastPenaltyAppliedAt: newLastPenaltyAppliedAt,
            },
          });

          await prisma.loanStatusEvent.create({
            data: {
              loanId: loan.id,
              status: "defaulted",
              previousStatus: "defaulted",
              note: `24-hour default penalty fee applied: +KES ${penaltyToAdd} (${intervalsPassed} cycle${intervalsPassed > 1 ? "s" : ""} @ KES ${dailyPenalty}/24h). Total penalty: KES ${newPenaltyAmount}. New total due: KES ${newTotalDue}.`,
            },
          });

          await prisma.auditLog.create({
            data: {
              action: "loan.default_penalty_applied",
              targetType: "loan",
              targetId: loan.id,
              details: {
                intervalsPassed,
                dailyPenalty,
                penaltyAdded: penaltyToAdd,
                totalPenalty: newPenaltyAmount,
                newTotalDue,
              },
            },
          });
        } else {
          await prisma.loan.update({
            where: { id: loan.id },
            data: {
              lastPenaltyAppliedAt: newLastPenaltyAppliedAt,
            },
          });
        }
      }
    }
  } catch (err) {
    console.error("[reconcileOverdueLoans error]:", err);
  }
}

/** Award the referrer a one-time credit-score boost (+5 points) on the first repaid loan. */
export async function awardReferralBonus(loanId: string) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: { id: true, userId: true },
  });
  if (!loan) return;

  const existing = await prisma.referralReward.findUnique({
    where: { loanId },
    select: { id: true },
  });
  if (existing) return;

  const borrower = await prisma.profile.findUnique({
    where: { id: loan.userId },
    select: { id: true, referredBy: true },
  });
  if (!borrower?.referredBy) return;

  const repaidCount = await prisma.loan.count({
    where: { userId: loan.userId, status: "repaid" },
  });
  if (repaidCount !== 1) return;

  const reward = 5;
  const referrer = await prisma.profile.findUnique({
    where: { id: borrower.referredBy },
    select: { credibilityScore: true, isEarningPointsFrozen: true },
  });
  if (!referrer) return;

  if (!referrer.isEarningPointsFrozen) {
    const newScore = Math.min(850, referrer.credibilityScore + reward);
    const { calculateLoanLimitForScore } = await import("./credibility.server");
    const newLimit = await calculateLoanLimitForScore(newScore);
    await prisma.profile.update({
      where: { id: borrower.referredBy },
      data: {
        credibilityScore: newScore,
        loanLimit: newLimit,
      },
    });
  }

  await prisma.referralReward.create({
    data: {
      referrerId: borrower.referredBy,
      referredId: loan.userId,
      loanId,
      scoreAwarded: referrer.isEarningPointsFrozen ? 0 : reward,
    },
  });
}

export interface RepaymentReceipt {
  receiptId: string;
  loanId: string;
  borrowerName: string;
  borrowerPhone: string;
  amount: number;
  mpesaReceipt: string;
  paidAt: string;
  businessName: string;
  shortcode: string;
}

export async function reconcileFullyPaidLoans() {
  await reconcileOverdueLoans();
  const openLoans = await prisma.loan.findMany({
    where: {
      status: {
        in: [
          "pending_guarantors",
          "pending_approval",
          "approved",
          "disbursing",
          "active",
          "defaulted",
        ],
      },
    },
    select: { id: true, totalDue: true, amountRepaid: true },
  });

  for (const loan of openLoans) {
    if (Number(loan.totalDue) > 0 && Number(loan.amountRepaid) >= Number(loan.totalDue)) {
      await recalcLoanAfterRepayment(loan.id);
    }
  }
}

export async function revertStuckDisbursingLoans() {
  try {
    const stuckLoans = await prisma.loan.findMany({
      where: {
        status: "disbursing",
      },
      select: {
        id: true,
        disbursedAt: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    const nowMs = Date.now();
    for (const loan of stuckLoans) {
      const disbursingTime = loan.disbursedAt || loan.updatedAt || loan.createdAt;
      const disbursingTs = disbursingTime ? new Date(disbursingTime).getTime() : 0;

      // Revert if stuck in "disbursing" for >= 3 minutes (180,000ms)
      if (disbursingTs > 0 && nowMs - disbursingTs >= 180000) {
        await prisma.loan.update({
          where: { id: loan.id },
          data: {
            status: "approved",
            disbursedAt: null,
          },
        });

        await prisma.loanStatusEvent.create({
          data: {
            loanId: loan.id,
            status: "approved",
            previousStatus: "disbursing",
            note: "Disbursement timed out after 3 minutes with no M-Pesa response. Reverted loan status back to approved for retry.",
          },
        });

        await prisma.auditLog.create({
          data: {
            action: "loan.disbursement_timed_out",
            targetType: "loan",
            targetId: loan.id,
            details: {
              reason: "Timed out after 3 minutes in disbursing status without M-Pesa B2C callback",
              previousStatus: "disbursing",
              newStatus: "approved",
            },
          },
        });
      }
    }
  } catch (err) {
    console.error("[revertStuckDisbursingLoans error]:", err);
  }
}

export async function reconcileActiveLoansWithoutPayout() {
  await revertStuckDisbursingLoans();
  const activeLoans = await prisma.loan.findMany({
    where: { status: "active" },
    include: {
      product: { select: { isTestTier: true } },
      user: { select: { phone: true } },
      guarantors: { select: { status: true } },
      mpesaTransactions: {
        where: {
          kind: "b2c_payout",
          status: "success",
        },
      },
    },
  });

  if (activeLoans.length === 0) return;

  for (const loan of activeLoans) {
    if (loan.product?.isTestTier) {
      // Sandbox / Test tier loans do not require live M-Pesa B2C payout verification
      continue;
    }

    const hasDirectPayout = loan.mpesaTransactions.length > 0;
    const hasPhonePayout =
      !hasDirectPayout &&
      Boolean(
        await prisma.mpesaTransaction.findFirst({
          where: {
            kind: "b2c_payout",
            status: "success",
            OR: [
              { loanId: loan.id },
              { phone: loan.disbursementPhone },
              { phone: loan.user?.phone ?? "" },
            ],
          },
        }),
      );

    if (!hasDirectPayout && !hasPhonePayout) {
      const acceptedGuarantors = loan.guarantors.filter((g) => g.status === "accepted").length;
      const targetStatus =
        acceptedGuarantors >= loan.guarantorsRequired ? "pending_approval" : "pending_guarantors";

      await prisma.loan.update({
        where: { id: loan.id },
        data: {
          status: targetStatus,
          disbursedAt: null,
          approvedAt: null,
          approvedBy: null,
          dueDate: null,
        },
      });

      await prisma.loanStatusEvent.create({
        data: {
          loanId: loan.id,
          status: targetStatus,
          previousStatus: "active",
          note: "Reverted active loan to pending because no successful M-Pesa B2C payout transaction was found for the loan or borrower phone number.",
        },
      });

      await prisma.auditLog.create({
        data: {
          action: "loan.reverted_to_pending",
          targetType: "loan",
          targetId: loan.id,
          details: {
            reason: "Active loan lacks completed M-Pesa B2C payout transaction",
            previousStatus: "active",
            newStatus: targetStatus,
          },
        },
      });
    }
  }
}

export async function buildRepaymentReceipt(repaymentId: string): Promise<RepaymentReceipt | null> {
  const repayment = await prisma.loanRepayment.findUnique({
    where: { id: repaymentId },
    include: {
      loan: true,
      user: true,
    },
  });
  if (!repayment) return null;

  const settings = await prisma.businessSettings.findFirst({
    select: { businessName: true, mpesaShortcode: true },
  });

  return {
    receiptId: repayment.id.slice(0, 8).toUpperCase(),
    loanId: repayment.loanId.slice(0, 8).toUpperCase(),
    borrowerName:
      `${repayment.user?.firstName ?? ""} ${repayment.user?.lastName ?? ""}`.trim() || "—",
    borrowerPhone: repayment.user?.phone ?? repayment.loan?.disbursementPhone ?? "—",
    amount: Number(repayment.amount),
    mpesaReceipt: repayment.mpesaReceipt ?? "—",
    paidAt: repayment.createdAt.toISOString(),
    businessName: settings?.businessName ?? process.env["BUSINESS_NAME"] ?? "Lending Platform",
    shortcode: settings?.mpesaShortcode ?? "—",
  };
}
