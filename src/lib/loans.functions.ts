import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireCustomAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";

const loanRequestSchema = z.object({
  productId: z.string().uuid(),
  amount: z.number().min(1).max(1000000),
  purpose: z.string().trim().min(3).max(200),
  phone: z.string().trim().min(9).max(15),
  guarantors: z.array(z.string().trim().min(3).max(30)).max(5),
});

export const listPublicLoanProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { ensureLoanProductsSeeded, getActiveEnvironment } = await import("./loans.server");
  await ensureLoanProductsSeeded();

  const environment = await getActiveEnvironment();

  const [products, settings] = await Promise.all([
    prisma.loanProduct.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.businessSettings.findFirst({
      select: { allTiersLocked: true },
    }),
  ]);

  const filteredProducts = products.filter((p) => {
    if (environment !== "sandbox" && p.isTestTier) return false;
    return true;
  });

  return filteredProducts.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    min_amount: Number(p.minAmount),
    max_amount: Number(p.maxAmount),
    interest_rate: Number(p.interestRate),
    processing_fee_rate: Number(p.processingFeeRate),
    penalty_rate:
      p.penaltyRate !== undefined && p.penaltyRate !== null ? Number(p.penaltyRate) : null,
    custom_penalty_amount:
      p.customPenaltyAmount !== null && p.customPenaltyAmount !== undefined
        ? Number(p.customPenaltyAmount)
        : null,
    term_days: p.termDays,
    min_credibility: p.minCredibility,
    guarantors_required: p.guarantorsRequired,
    sort_order: p.sortOrder,
    is_active: p.isActive,
    is_test_tier: Boolean(p.isTestTier),
    is_locked: Boolean(settings?.allTiersLocked) || p.isLocked,
  }));
});

export const listLoanProducts = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { ensureLoanProductsSeeded, getActiveEnvironment, reconcileOverdueLoans } =
      await import("./loans.server");
    await ensureLoanProductsSeeded();
    await reconcileOverdueLoans();

    const environment = await getActiveEnvironment();
    const userId = context.userId;

    const [products, settings, defaultedLoan] = await Promise.all([
      prisma.loanProduct.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.businessSettings.findFirst({
        select: {
          allTiersLocked: true,
          autoRejectIfDefaulted: true,
          requireGuarantorsForLoans: true,
          maxActiveLoansPerBorrower: true,
        },
      }),
      prisma.loan.findFirst({
        where: { userId, status: "defaulted" },
        select: { id: true },
      }),
    ]);

    const filteredProducts = products.filter((p) => {
      if (environment !== "sandbox" && p.isTestTier) return false;
      return true;
    });

    const autoRejectDefaulted = settings?.autoRejectIfDefaulted ?? true;
    const hasDefaultedLoan = autoRejectDefaulted ? Boolean(defaultedLoan) : false;
    const requireGuarantors = settings?.requireGuarantorsForLoans ?? true;

    return filteredProducts.map((p) => {
      const isLockedForUser =
        hasDefaultedLoan ||
        Boolean(settings?.allTiersLocked) ||
        p.isLocked ||
        (Array.isArray(p.lockedUserIds) && p.lockedUserIds.includes(userId));

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        min_amount: Number(p.minAmount),
        max_amount: Number(p.maxAmount),
        interest_rate: Number(p.interestRate),
        processing_fee_rate: Number(p.processingFeeRate),
        penalty_rate:
          p.penaltyRate !== undefined && p.penaltyRate !== null ? Number(p.penaltyRate) : null,
        custom_penalty_amount:
          p.customPenaltyAmount !== null && p.customPenaltyAmount !== undefined
            ? Number(p.customPenaltyAmount)
            : null,
        term_days: p.termDays,
        min_credibility: p.minCredibility,
        guarantors_required: requireGuarantors ? p.guarantorsRequired : 0,
        sort_order: p.sortOrder,
        is_active: p.isActive,
        is_test_tier: Boolean(p.isTestTier),
        is_locked: isLockedForUser,
        is_locked_due_to_default: hasDefaultedLoan,
        is_globally_locked: p.isLocked,
      };
    });
  });

export const getMyLoanCenter = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const {
      getActiveEnvironment,
      reconcileActiveLoansWithoutPayout,
      reconcileFullyPaidLoans,
      reconcileOverdueLoans,
    } = await import("./loans.server");
    await reconcileOverdueLoans();
    await reconcileActiveLoansWithoutPayout();
    await reconcileFullyPaidLoans();

    const environment = await getActiveEnvironment();
    const isSandbox = environment === "sandbox";

    const [profile, loans, guaranteeing] = await Promise.all([
      prisma.profile.findUnique({
        where: { id: userId },
        select: { isEarningPointsFrozen: true },
      }),
      prisma.loan.findMany({
        where: { userId },
        include: {
          product: {
            select: {
              name: true,
              termDays: true,
              penaltyRate: true,
              customPenaltyAmount: true,
              interestRate: true,
            },
          },
          guarantors: { select: { id: true, status: true, guarantorId: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.loanGuarantor.findMany({
        where: { guarantorId: userId },
        include: {
          loan: {
            select: {
              id: true,
              principal: true,
              totalDue: true,
              purpose: true,
              status: true,
              userId: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const hasDefaulted = loans.some(
      (l) =>
        (l.status === "defaulted" ||
          (l.status === "active" &&
            l.dueDate &&
            new Date(l.dueDate) < new Date() &&
            Number(l.amountRepaid) < Number(l.totalDue))) &&
        l.status !== "repaid",
    );
    const isFrozen = Boolean(profile?.isEarningPointsFrozen || hasDefaulted || isSandbox);
    let frozenReason: string | null = null;
    if (isSandbox) {
      frozenReason = "Points earning is frozen in Sandbox Mode.";
    } else if (hasDefaulted) {
      frozenReason =
        "Points earning is frozen due to a defaulted loan. Repay your loan to restore credibility progress.";
    } else if (profile?.isEarningPointsFrozen) {
      frozenReason = "Points earning has been frozen by administration.";
    }

    return {
      is_sandbox: isSandbox,
      is_frozen: isFrozen,
      frozen_reason: frozenReason,
      has_defaulted_loan: hasDefaulted,
      is_admin_frozen: Boolean(profile?.isEarningPointsFrozen),
      loans: loans.map((l) => ({
        id: l.id,
        user_id: l.userId,
        product_id: l.productId,
        principal: Number(l.principal),
        interest_amount: Number(l.interestAmount),
        processing_fee: Number(l.processingFee),
        penalty_amount: Number(l.penaltyAmount || 0),
        penalty_count: l.penaltyCount || 0,
        last_penalty_applied_at: l.lastPenaltyAppliedAt
          ? l.lastPenaltyAppliedAt.toISOString()
          : null,
        total_due: Number(l.totalDue),
        amount_repaid: Number(l.amountRepaid),
        status: l.status,
        purpose: l.purpose,
        disbursement_phone: l.disbursementPhone,
        guarantors_required: l.guarantorsRequired,
        due_date: l.dueDate ? l.dueDate.toISOString() : null,
        approved_at: l.approvedAt ? l.approvedAt.toISOString() : null,
        repaid_at: l.repaidAt ? l.repaidAt.toISOString() : null,
        created_at: l.createdAt.toISOString(),
        loan_products: l.product
          ? {
              name: l.product.name,
              term_days: l.product.termDays,
              penalty_rate:
                l.product.penaltyRate !== undefined && l.product.penaltyRate !== null
                  ? Number(l.product.penaltyRate)
                  : 0.25,
              custom_penalty_amount:
                l.product.customPenaltyAmount !== null &&
                l.product.customPenaltyAmount !== undefined
                  ? Number(l.product.customPenaltyAmount)
                  : null,
            }
          : null,
        loan_guarantors: l.guarantors.map((g) => ({
          id: g.id,
          status: g.status,
          guarantor_id: g.guarantorId,
        })),
      })),
      guaranteeing: guaranteeing.map((g) => ({
        id: g.id,
        status: g.status,
        created_at: g.createdAt.toISOString(),
        loans: g.loan
          ? {
              id: g.loan.id,
              principal: Number(g.loan.principal),
              total_due: Number(g.loan.totalDue),
              purpose: g.loan.purpose,
              status: g.loan.status,
              user_id: g.loan.userId,
            }
          : null,
      })),
    };
  });

export const requestLoan = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => loanRequestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles = [] } = context;
    if (roles.includes("super_admin") || roles.includes("staff")) {
      throw new Error("Administrators and staff agents are not eligible to apply for loans.");
    }
    const {
      quoteLoan,
      resolveGuarantors,
      reconcileActiveLoansWithoutPayout,
      reconcileFullyPaidLoans,
    } = await import("./loans.server");
    const { normalizePhone } = await import("./format");

    await reconcileActiveLoansWithoutPayout();
    await reconcileFullyPaidLoans();

    const [profile, product, openLoans, settings] = await Promise.all([
      prisma.profile.findUnique({ where: { id: userId } }),
      prisma.loanProduct.findUnique({ where: { id: data.productId } }),
      prisma.loan.findMany({
        where: {
          userId,
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
        select: { id: true, status: true },
      }),
      prisma.businessSettings.findFirst({
        select: {
          allTiersLocked: true,
          maxActiveLoansPerBorrower: true,
          requireGuarantorsForLoans: true,
          autoRejectIfDefaulted: true,
        },
      }),
    ]);

    if (!profile) throw new Error("Profile not found.");
    if (profile.status !== "active") throw new Error("Your account is not active.");
    if (!product || !product.isActive) throw new Error("That loan tier is unavailable.");

    const { getActiveEnvironment } = await import("./loans.server");
    const environment = await getActiveEnvironment();

    if (product.isTestTier && environment !== "sandbox") {
      throw new Error("Sandbox test loan tier is only available in Sandbox mode.");
    }

    const autoReject = settings?.autoRejectIfDefaulted ?? true;
    const hasDefaultedLoan = openLoans.some((l) => l.status === "defaulted");
    if (autoReject && hasDefaultedLoan) {
      throw new Error(
        "Your account is locked from requesting new loans due to an unpaid defaulted loan (System Rule). Please repay your defaulted loan to restore loan access.",
      );
    }

    if (
      settings?.allTiersLocked ||
      product.isLocked ||
      (Array.isArray(product.lockedUserIds) && product.lockedUserIds.includes(userId))
    ) {
      throw new Error("This loan tier is currently locked by administrator.");
    }

    const maxActive = settings?.maxActiveLoansPerBorrower ?? 1;
    if (openLoans.length >= maxActive) {
      throw new Error(
        `You have reached the maximum allowed limit of ${maxActive} active or pending loan(s) set by System Rules.`,
      );
    }

    if (profile.credibilityScore < product.minCredibility) {
      throw new Error(`${product.name} needs a credibility score of ${product.minCredibility}.`);
    }
    if (data.amount < Number(product.minAmount) || data.amount > Number(product.maxAmount)) {
      throw new Error(`${product.name} allows KES ${product.minAmount} – ${product.maxAmount}.`);
    }
    if (!product.isTestTier && data.amount > Number(profile.loanLimit)) {
      throw new Error("That amount is above your current loan limit.");
    }

    const requireGuarantors = settings?.requireGuarantorsForLoans ?? true;
    const effectiveGuarantorsRequired = requireGuarantors ? product.guarantorsRequired : 0;

    if (effectiveGuarantorsRequired > 0 && data.guarantors.length !== effectiveGuarantorsRequired) {
      throw new Error(`${product.name} requires ${effectiveGuarantorsRequired} guarantor(s).`);
    }

    const guarantors =
      effectiveGuarantorsRequired > 0 ? await resolveGuarantors(data.guarantors, userId) : [];
    const quote = quoteLoan(
      {
        interestRate: product.interestRate,
        processingFeeRate: product.processingFeeRate,
        termDays: product.termDays,
      },
      data.amount,
    );

    const requiresMemberApproval = guarantors.some((g) => Boolean(g.id));
    const initialStatus = requiresMemberApproval ? "pending_guarantors" : "pending_approval";

    const loan = await prisma.$transaction(async (tx) => {
      const createdLoan = await tx.loan.create({
        data: {
          userId,
          productId: product.id,
          principal: quote.principal,
          interestAmount: quote.interestAmount,
          processingFee: quote.processingFee,
          totalDue: quote.totalDue,
          purpose: data.purpose,
          disbursementPhone: normalizePhone(data.phone),
          guarantorsRequired: effectiveGuarantorsRequired,
          dueDate: new Date(quote.dueDate),
          status: initialStatus,
        },
      });

      if (guarantors.length > 0) {
        await tx.loanGuarantor.createMany({
          data: guarantors.map((g) => ({
            loanId: createdLoan.id,
            guarantorId: g.id ?? null,
            firstName: g.firstName ?? "",
            lastName: g.lastName ?? "",
            phone: g.phone ?? "",
            idNumber: g.idNumber ?? "",
            relationship: g.relationship ?? "",
            occupation: g.occupation ?? "",
            address: g.address ?? "",
            status: g.id ? "pending" : "accepted",
          })),
        });
      }

      await tx.loanStatusEvent.create({
        data: {
          loanId: createdLoan.id,
          status: initialStatus,
          note: "Loan created",
        },
      });

      return createdLoan;
    });

    try {
      const { notifyNewLoanRequested } = await import("./notifications.server");
      await notifyNewLoanRequested({
        id: loan.id,
        userId,
        principal: quote.principal,
        productName: product.name,
      });
    } catch (err) {
      console.error("[requestLoan notification error]:", err);
    }

    return { ok: true as const, loanId: loan.id };
  });

export const respondToGuarantee = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) =>
    z.object({ requestId: z.string().uuid(), accept: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const req = await prisma.loanGuarantor.findFirst({
      where: { id: data.requestId, guarantorId: userId },
    });
    if (!req) throw new Error("Guarantor request not found.");

    await prisma.loanGuarantor.update({
      where: { id: data.requestId },
      data: {
        status: data.accept ? "accepted" : "rejected",
        respondedAt: new Date(),
      },
    });

    const siblings = await prisma.loanGuarantor.findMany({
      where: { loanId: req.loanId },
      select: { status: true },
    });

    if (siblings.some((s) => s.status === "rejected")) {
      await prisma.loan.updateMany({
        where: { id: req.loanId, status: "pending_guarantors" },
        data: { status: "rejected", rejectionReason: "A guarantor rejected the request." },
      });
      await prisma.loanStatusEvent.create({
        data: {
          loanId: req.loanId,
          status: "rejected",
          previousStatus: "pending_guarantors",
          actorId: userId,
          note: "Guarantor rejected request",
        },
      });
    } else if (siblings.every((s) => s.status === "accepted")) {
      await prisma.loan.updateMany({
        where: { id: req.loanId, status: "pending_guarantors" },
        data: { status: "pending_approval" },
      });
      await prisma.loanStatusEvent.create({
        data: {
          loanId: req.loanId,
          status: "pending_approval",
          previousStatus: "pending_guarantors",
          actorId: userId,
          note: "All guarantors accepted",
        },
      });
    }

    if (data.accept) {
      const parentLoan = await prisma.loan.findUnique({
        where: { id: req.loanId },
        select: { userId: true },
      });
      if (parentLoan?.userId) {
        const { syncUserCredibilityScore } = await import("./credibility.server");
        await syncUserCredibilityScore(parentLoan.userId);
      }
    }

    return { ok: true as const };
  });

export const listAdminLoans = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const { reconcileActiveLoansWithoutPayout, reconcileFullyPaidLoans, reconcileOverdueLoans } =
      await import("./loans.server");
    await reconcileActiveLoansWithoutPayout();
    await reconcileOverdueLoans();
    await reconcileFullyPaidLoans();

    const loans = await prisma.loan.findMany({
      include: {
        product: { select: { name: true } },
        guarantors: { select: { status: true } },
        user: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const approverIds = Array.from(
      new Set(loans.map((l) => l.approvedBy).filter(Boolean)),
    ) as string[];
    const approvers = await prisma.profile.findMany({
      where: { id: { in: approverIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        roles: { select: { role: true } },
      },
    });
    const approverMap = new Map(
      approvers.map((a) => [
        a.id,
        {
          id: a.id,
          firstName: a.firstName,
          lastName: a.lastName,
          email: a.email,
          role: a.roles[0]?.role ?? "staff",
        },
      ]),
    );

    const { isDarajaConfigured } = await import("./mpesa.server");
    const darajaCheck = await isDarajaConfigured();

    return loans.map((l) => {
      const ap = l.approvedBy ? approverMap.get(l.approvedBy) : null;
      return {
        id: l.id,
        user_id: l.userId,
        is_daraja_configured: darajaCheck,
        principal: Number(l.principal),
        interest_amount: Number(l.interestAmount),
        processing_fee: Number(l.processingFee),
        penalty_amount: Number(l.penaltyAmount || 0),
        penalty_count: l.penaltyCount || 0,
        last_penalty_applied_at: l.lastPenaltyAppliedAt
          ? l.lastPenaltyAppliedAt.toISOString()
          : null,
        last_overdue_reminder_at: l.lastOverdueReminderAt
          ? l.lastOverdueReminderAt.toISOString()
          : null,
        total_due: Number(l.totalDue),
        amount_repaid: Number(l.amountRepaid),
        status: l.status,
        purpose: l.purpose,
        disbursement_phone: l.disbursementPhone,
        created_at: l.createdAt.toISOString(),
        loan_products: l.product ? { name: l.product.name } : null,
        loan_guarantors: l.guarantors.map((g) => ({ status: g.status })),
        approved_by_user: ap
          ? {
              id: ap.id,
              name: `${ap.firstName} ${ap.lastName}`.trim() || ap.email,
              email: ap.email,
              role: ap.role,
            }
          : null,
        borrower: l.user
          ? {
              id: l.user.id,
              first_name: l.user.firstName,
              last_name: l.user.lastName,
              phone: l.user.phone,
            }
          : null,
      };
    });
  });

export const decideLoan = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) =>
    z
      .object({
        loanId: z.string().uuid(),
        approve: z.boolean(),
        reason: z.string().trim().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const targetLoan = await prisma.loan.findUnique({
      where: { id: data.loanId },
      include: { product: true },
    });
    if (!targetLoan) throw new Error("Loan not found");

    if (data.approve) {
      const now = new Date();
      const termDays = targetLoan.product?.termDays ?? 30;
      const dueDate = new Date(now.getTime() + termDays * 86400000);

      await prisma.loan.update({
        where: { id: data.loanId },
        data: {
          status: "approved",
          approvedAt: now,
          approvedBy: userId,
          dueDate,
        },
      });

      await prisma.loanStatusEvent.create({
        data: {
          loanId: data.loanId,
          status: "approved",
          previousStatus: targetLoan.status,
          actorId: userId,
          note: "Loan approved by administrator. Awaiting M-Pesa disbursement.",
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: userId,
          action: "loan.approved",
          targetType: "loan",
          targetId: data.loanId,
        },
      });
    } else {
      await prisma.loan.update({
        where: { id: data.loanId },
        data: {
          status: "rejected",
          rejectionReason: data.reason ?? "Not approved.",
          approvedBy: userId,
        },
      });

      await prisma.loanStatusEvent.create({
        data: {
          loanId: data.loanId,
          status: "rejected",
          previousStatus: targetLoan.status,
          actorId: userId,
          note: data.reason ?? "Rejected",
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: userId,
          action: "loan.rejected",
          targetType: "loan",
          targetId: data.loanId,
        },
      });
    }

    try {
      const { notifyLoanStatusChanged } = await import("./notifications.server");
      await notifyLoanStatusChanged({
        loanId: data.loanId,
        userId: targetLoan.userId,
        status: data.approve ? "approved" : "rejected",
        amount: Number(targetLoan.principal),
        rejectionReason: data.approve ? undefined : data.reason,
      });
    } catch (err) {
      console.error("[decideLoan notification error]:", err);
    }

    return { ok: true as const };
  });

export const cancelLoanByAdmin = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) =>
    z
      .object({
        loanId: z.string().uuid(),
        reason: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden: Only administrators and staff agents can cancel loan requests.");
    }

    const targetLoan = await prisma.loan.findUnique({
      where: { id: data.loanId },
      include: { product: true },
    });
    if (!targetLoan) throw new Error("Loan not found");

    const nonCancellableStatuses = ["disbursing", "active", "repaid", "defaulted"];
    if (nonCancellableStatuses.includes(targetLoan.status)) {
      throw new Error(
        "Activated or cash disbursed loans cannot be rejected. Active financial contracts are locked.",
      );
    }

    if (targetLoan.status === "rejected") {
      throw new Error("This loan request has already been rejected.");
    }

    const cancelReason = data.reason || "Loan request rejected by administrator / agent.";

    await prisma.loan.update({
      where: { id: data.loanId },
      data: {
        status: "rejected",
        rejectionReason: cancelReason,
        approvedBy: userId,
      },
    });

    await prisma.loanStatusEvent.create({
      data: {
        loanId: data.loanId,
        status: "rejected",
        previousStatus: targetLoan.status,
        actorId: userId,
        note: cancelReason,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "loan.rejected_by_admin",
        targetType: "loan",
        targetId: data.loanId,
        details: { reason: cancelReason, previousStatus: targetLoan.status },
      },
    });

    try {
      const { notifyLoanStatusChanged } = await import("./notifications.server");
      await notifyLoanStatusChanged({
        loanId: data.loanId,
        userId: targetLoan.userId,
        status: "rejected",
        amount: Number(targetLoan.principal),
        rejectionReason: cancelReason,
      });
    } catch (err) {
      console.error("[cancelLoanByAdmin notification error]:", err);
    }

    return { ok: true as const, message: "Loan request rejected successfully." };
  });

export const activateLoan = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ loanId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const settings = await prisma.businessSettings.findFirst({
      select: { allowActivationWithoutDisbursement: true },
    });
    if (settings && !settings.allowActivationWithoutDisbursement) {
      throw new Error(
        "Manual loan activation without disbursement is disabled by System Rules. Please disburse via M-Pesa or enable 'Allow Loan Activation Without Disbursement' in Rules & Security.",
      );
    }

    const { loanId } = data;
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { product: true },
    });
    if (!loan) {
      throw new Error("Loan not found");
    }

    const activatableStatuses = [
      "pending_guarantors",
      "pending_approval",
      "approved",
      "disbursing",
    ];
    if (!activatableStatuses.includes(loan.status)) {
      if (loan.status === "active") {
        return { ok: true as const, message: "Loan is already active." };
      }
      throw new Error(`Cannot activate loan in '${loan.status}' status.`);
    }

    const now = new Date();
    const termDays = loan.product?.termDays ?? 30;
    const dueDate = loan.dueDate ?? new Date(now.getTime() + termDays * 86400000);

    await prisma.loan.update({
      where: { id: loanId },
      data: {
        status: "active",
        approvedAt: loan.approvedAt ?? now,
        disbursedAt: loan.disbursedAt ?? now,
        approvedBy: loan.approvedBy ?? userId,
        dueDate,
      },
    });

    await prisma.loanStatusEvent.create({
      data: {
        loanId,
        status: "active",
        previousStatus: loan.status,
        actorId: userId,
        note: "Loan manually activated by administrator.",
      },
    });

    const payout = Number(loan.principal) - Number(loan.processingFee);
    await prisma.mpesaTransaction.create({
      data: {
        loanId: loan.id,
        userId: loan.userId,
        kind: "b2c_payout",
        status: "success",
        amount: payout,
        phone: loan.disbursementPhone,
        mpesaReceipt: `ACT-${loan.id.slice(0, 8).toUpperCase()}`,
        resultCode: "0",
        resultDesc: "Manually activated / Sandbox payout",
        payload: { note: "Activated via Admin interface" },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "loan.activated_manually",
        targetType: "loan",
        targetId: loan.id,
        details: { previousStatus: loan.status },
      },
    });

    try {
      const { notifyLoanStatusChanged } = await import("./notifications.server");
      await notifyLoanStatusChanged({
        loanId: loan.id,
        userId: loan.userId,
        status: "active",
        amount: Number(loan.principal),
      });
    } catch (err) {
      console.error("[activateLoan notification error]:", err);
    }

    return { ok: true as const, message: "Loan activated successfully." };
  });

export const disburseLoan = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ loanId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const { loadMpesaConfig } = await import("./loans.server");
    const { b2cPayout, isDarajaConfigured } = await import("./mpesa.server");

    // 1. Verify Daraja API credentials are set
    const check = await isDarajaConfigured();
    if (!check.configured) {
      throw new Error(
        `Cannot disburse loan: Daraja API credentials are not set. ${check.reason ?? "Please configure Daraja M-Pesa credentials in Admin Settings."}`,
      );
    }

    const loan = await prisma.loan.findUnique({
      where: { id: data.loanId },
      include: {
        guarantors: {
          select: { status: true },
        },
      },
    });

    if (!loan) throw new Error("Loan not found.");

    if (loan.status !== "approved" && loan.status !== "disbursing") {
      throw new Error("Only approved loans can be disbursed.");
    }

    // 2. Verify all required guarantors are approved (if required by System Rules)
    const settings = await prisma.businessSettings.findFirst({
      select: { requireGuarantorsForLoans: true },
    });
    const requireGuarantors = settings?.requireGuarantorsForLoans ?? true;

    if (requireGuarantors && loan.guarantorsRequired > 0) {
      const acceptedCount = loan.guarantors.filter((g) => g.status === "accepted").length;
      if (acceptedCount < loan.guarantorsRequired) {
        throw new Error(
          `Cannot disburse loan: Guarantor requirements not met (${acceptedCount} of ${loan.guarantorsRequired} approved).`,
        );
      }
    }

    const payout = Number(loan.principal) - Number(loan.processingFee);

    let config;
    try {
      config = await loadMpesaConfig(`https://${getRequestHost()}`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`Cannot disburse loan: ${errMsg}`);
    }

    let result;
    try {
      result = await b2cPayout(config, {
        phone: loan.disbursementPhone,
        amount: payout,
        remarks: `Loan disbursement ${loan.id.slice(0, 8)}`,
        occasion: "LoanDisbursement",
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await prisma.mpesaTransaction.create({
        data: {
          loanId: loan.id,
          userId: loan.userId,
          kind: "b2c_payout",
          status: "failed",
          amount: payout,
          phone: loan.disbursementPhone,
          resultDesc: errMsg,
          payload: { error: errMsg },
        },
      });

      // Keep loan status as 'approved' so admin can retry disbursement!
      await prisma.loan.update({
        where: { id: loan.id },
        data: { status: "approved" },
      });

      await prisma.loanStatusEvent.create({
        data: {
          loanId: loan.id,
          status: "approved",
          previousStatus: loan.status,
          actorId: userId,
          note: `M-Pesa disbursement attempt failed: ${errMsg}. Loan remains in approved status for retry.`,
        },
      });

      throw new Error(
        `Disbursement failed: ${errMsg}. Loan status remains 'approved' so you can retry.`,
      );
    }

    await prisma.mpesaTransaction.create({
      data: {
        loanId: loan.id,
        userId: loan.userId,
        kind: "b2c_payout",
        status: result.ok ? "pending" : "failed",
        amount: payout,
        phone: loan.disbursementPhone,
        conversationId: result.conversationId ?? null,
        originatorConversationId: result.originatorConversationId ?? null,
        resultDesc: result.message,
        payload: (result.raw as object) ?? {},
      },
    });

    if (!result.ok) {
      // Disbursement rejected by M-Pesa API -> keep loan status as 'approved' for retry!
      await prisma.loan.update({
        where: { id: loan.id },
        data: { status: "approved" },
      });

      await prisma.loanStatusEvent.create({
        data: {
          loanId: loan.id,
          status: "approved",
          previousStatus: loan.status,
          actorId: userId,
          note: `M-Pesa rejected disbursement: ${result.message}. Loan remains in approved status for retry.`,
        },
      });

      throw new Error(
        `Disbursement failed: ${result.message}. Loan status remains 'approved' so you can retry.`,
      );
    }

    await prisma.loan.update({
      where: { id: loan.id },
      data: {
        status: "disbursing",
        approvedBy: loan.approvedBy ?? userId,
      },
    });

    await prisma.loanStatusEvent.create({
      data: {
        loanId: loan.id,
        status: "disbursing",
        previousStatus: "approved",
        actorId: userId,
        note: "Disbursement payout sent to M-Pesa",
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "loan.disbursement_initiated",
        targetType: "loan",
        targetId: loan.id,
      },
    });

    return { ok: true as const, message: result.message };
  });

export const getLoanTimeline = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ loanId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;

    const loan = await prisma.loan.findUnique({
      where: { id: data.loanId },
      select: { id: true, userId: true, status: true, createdAt: true },
    });
    if (!loan) throw new Error("Loan not found.");

    const isStaff = roles.includes("super_admin") || roles.includes("staff");
    if (loan.userId !== userId && !isStaff) throw new Error("Forbidden");

    const events = await prisma.loanStatusEvent.findMany({
      where: { loanId: data.loanId },
      orderBy: { createdAt: "asc" },
    });

    if (events.length === 0) {
      return [
        {
          id: `initial-${loan.id}`,
          status: loan.status,
          previous_status: null,
          note: "Loan application received.",
          actor_id: loan.userId,
          actor_name: null,
          actor_role: "borrower",
          created_at: (loan.createdAt ? new Date(loan.createdAt) : new Date()).toISOString(),
        },
      ];
    }

    const actorIds = Array.from(new Set(events.map((e) => e.actorId).filter(Boolean))) as string[];
    const actors = await prisma.profile.findMany({
      where: { id: { in: actorIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        roles: { select: { role: true } },
      },
    });
    const actorMap = new Map(
      actors.map((a) => [
        a.id,
        {
          id: a.id,
          firstName: a.firstName,
          lastName: a.lastName,
          email: a.email,
          role: a.roles[0]?.role ?? "staff",
        },
      ]),
    );

    return events.map((e) => {
      const actor = e.actorId ? actorMap.get(e.actorId) : null;
      return {
        id: e.id,
        status: e.status,
        previous_status: e.previousStatus,
        note: e.note,
        actor_id: e.actorId,
        actor_name: actor ? `${actor.firstName} ${actor.lastName}`.trim() || actor.email : null,
        actor_role: actor ? actor.role : null,
        created_at: e.createdAt.toISOString(),
      };
    });
  });

export const getRepaymentReceipt = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ repaymentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;

    const repayment = await prisma.loanRepayment.findUnique({
      where: { id: data.repaymentId },
      select: { id: true, userId: true },
    });
    if (!repayment) throw new Error("Repayment not found.");

    const isStaff = roles.includes("super_admin") || roles.includes("staff");
    if (repayment.userId !== userId && !isStaff) throw new Error("Forbidden");

    const { buildRepaymentReceipt } = await import("./loans.server");
    return await buildRepaymentReceipt(data.repaymentId);
  });

export const retryFailedPayment = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) =>
    z
      .object({
        loanId: z.string().uuid(),
        amount: z.number().min(1).max(1000000),
        phone: z.string().trim().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { loadMpesaConfig } = await import("./loans.server");
    const { stkPush } = await import("./mpesa.server");
    const { normalizePhone } = await import("./format");

    const loan = await prisma.loan.findFirst({
      where: { id: data.loanId, userId: context.userId },
      select: {
        id: true,
        userId: true,
        totalDue: true,
        amountRepaid: true,
        disbursementPhone: true,
        status: true,
      },
    });

    if (!loan) throw new Error("Loan not found.");
    if (loan.status !== "active" && loan.status !== "defaulted") {
      throw new Error("This loan is not open for repayment.");
    }
    const outstanding = Number(loan.totalDue) - Number(loan.amountRepaid);
    if (outstanding <= 0) throw new Error("This loan is already fully repaid.");
    const amount = Math.min(data.amount, outstanding);

    const userProfile = await prisma.profile.findUnique({
      where: { id: context.userId },
      select: { phone: true },
    });

    const rawPhone = data.phone?.trim() || loan.disbursementPhone || userProfile?.phone || "";
    const targetPhone = normalizePhone(rawPhone);

    if (!targetPhone || targetPhone.length < 9) {
      throw new Error("Please enter a valid M-Pesa phone number to make repayment.");
    }

    const config = await loadMpesaConfig(`https://${getRequestHost()}`);
    const result = await stkPush(config, {
      phone: targetPhone,
      amount,
      reference: loan.id.slice(0, 8).toUpperCase(),
      description: "Loan repayment retry",
    });

    await prisma.mpesaTransaction.create({
      data: {
        loanId: loan.id,
        userId: loan.userId,
        kind: "stk_push",
        status: result.ok ? "pending" : "failed",
        amount,
        phone: targetPhone,
        checkoutRequestId: result.checkoutRequestId ?? null,
        merchantRequestId: result.merchantRequestId ?? null,
        resultDesc: result.message,
        payload: (result.raw as object) ?? {},
      },
    });

    if (!result.ok) throw new Error(result.message);
    return {
      ok: true as const,
      message: `M-Pesa prompt sent to ${targetPhone}. Check your phone.`,
    };
  });

export const listMyRepayments = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const repayments = await prisma.loanRepayment.findMany({
      where: { userId },
      include: {
        loan: { select: { id: true, principal: true, totalDue: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return repayments.map((r) => ({
      id: r.id,
      loan_id: r.loanId,
      amount: Number(r.amount),
      mpesa_receipt: r.mpesaReceipt,
      created_at: r.createdAt.toISOString(),
      loans: r.loan
        ? {
            id: r.loan.id,
            principal: Number(r.loan.principal),
            total_due: Number(r.loan.totalDue),
          }
        : null,
    }));
  });

export const startRepayment = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) =>
    z
      .object({
        loanId: z.string().uuid(),
        amount: z.number().min(1).max(1000000),
        phone: z.string().trim().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { loadMpesaConfig } = await import("./loans.server");
    const { stkPush } = await import("./mpesa.server");
    const { normalizePhone } = await import("./format");

    const loan = await prisma.loan.findFirst({
      where: { id: data.loanId, userId: context.userId },
      select: {
        id: true,
        userId: true,
        totalDue: true,
        amountRepaid: true,
        disbursementPhone: true,
        status: true,
      },
    });

    if (!loan) throw new Error("Loan not found.");
    if (loan.status !== "active" && loan.status !== "defaulted") {
      throw new Error("This loan is not open for repayment.");
    }
    const outstanding = Number(loan.totalDue) - Number(loan.amountRepaid);
    if (outstanding <= 0) throw new Error("This loan is already fully repaid.");
    const amount = Math.min(data.amount, outstanding);

    const userProfile = await prisma.profile.findUnique({
      where: { id: context.userId },
      select: { phone: true },
    });

    const rawPhone = data.phone?.trim() || loan.disbursementPhone || userProfile?.phone || "";
    const targetPhone = normalizePhone(rawPhone);

    if (!targetPhone || targetPhone.length < 9) {
      throw new Error("Please enter a valid M-Pesa phone number to make repayment.");
    }

    const config = await loadMpesaConfig(`https://${getRequestHost()}`);
    const result = await stkPush(config, {
      phone: targetPhone,
      amount,
      reference: loan.id.slice(0, 8).toUpperCase(),
      description: "Loan repayment",
    });

    await prisma.mpesaTransaction.create({
      data: {
        loanId: loan.id,
        userId: loan.userId,
        kind: "stk_push",
        status: result.ok ? "pending" : "failed",
        amount,
        phone: targetPhone,
        checkoutRequestId: result.checkoutRequestId ?? null,
        merchantRequestId: result.merchantRequestId ?? null,
        resultDesc: result.message,
        payload: (result.raw as object) ?? {},
      },
    });

    if (!result.ok) throw new Error(result.message);
    return {
      ok: true as const,
      message: `Check your phone (${targetPhone}) and enter your M-Pesa PIN.`,
    };
  });

export const listUserGuarantors = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const items = await prisma.userGuarantor.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    return items.map((g) => ({
      id: g.id,
      first_name: g.firstName,
      last_name: g.lastName,
      phone: g.phone,
      id_number: g.idNumber,
      address: g.address,
      relationship: g.relationship,
      occupation: g.occupation,
      created_at: g.createdAt.toISOString(),
    }));
  });

const userGuarantorSchema = z.object({
  id: z.string().uuid().optional(),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  phone: z.string().trim().min(9, "Phone number is required"),
  idNumber: z.string().trim().min(4, "ID number is required"),
  address: z.string().trim().min(1, "Address is required"),
  relationship: z.string().trim().min(1, "Relationship is required"),
  occupation: z.string().trim().optional(),
});

export const saveUserGuarantor = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => userGuarantorSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.id) {
      await prisma.userGuarantor.updateMany({
        where: { id: data.id, userId },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          idNumber: data.idNumber,
          address: data.address,
          relationship: data.relationship,
          occupation: data.occupation ?? "",
        },
      });
    } else {
      await prisma.userGuarantor.create({
        data: {
          userId,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          idNumber: data.idNumber,
          address: data.address,
          relationship: data.relationship,
          occupation: data.occupation ?? "",
        },
      });
    }
    const { syncUserCredibilityScore } = await import("./credibility.server");
    await syncUserCredibilityScore(userId);
    return { ok: true as const };
  });

export const deleteUserGuarantor = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await prisma.userGuarantor.deleteMany({
      where: { id: data.id, userId: context.userId },
    });
    const { syncUserCredibilityScore } = await import("./credibility.server");
    await syncUserCredibilityScore(context.userId);
    return { ok: true as const };
  });

const testimonialSchema = z.object({
  id: z.string().uuid().optional(),
  content: z.string().trim().min(10, "Testimonial must be at least 10 characters").max(500),
  rating: z.number().int().min(1).max(5).default(5),
  role: z.string().trim().max(100).optional(),
});

export const submitTestimonial = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => testimonialSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const profile = await prisma.profile.findUnique({ where: { id: userId } });
    if (!profile) throw new Error("Profile not found");

    const authorName = `${profile.firstName} ${profile.lastName}`.trim() || "Borrower";

    if (data.id) {
      await prisma.testimonial.updateMany({
        where: { id: data.id, userId },
        data: {
          content: data.content,
          rating: data.rating,
          role: data.role || "Borrower",
          status: "pending",
        },
      });
    } else {
      await prisma.testimonial.create({
        data: {
          userId,
          authorName,
          content: data.content,
          rating: data.rating,
          role: data.role || "Borrower",
          status: "pending",
        },
      });
    }
    return { ok: true as const };
  });

export const listMyTestimonials = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const list = await prisma.testimonial.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return list.map((t) => ({
      id: t.id,
      author_name: t.authorName,
      role: t.role,
      content: t.content,
      rating: t.rating,
      status: t.status,
      created_at: t.createdAt.toISOString(),
    }));
  });

export const deleteTestimonial = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await prisma.testimonial.deleteMany({
      where: { id: data.id, userId: context.userId },
    });
    return { ok: true as const };
  });

export const getAdminLoanDetails = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ loanId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const { reconcileActiveLoansWithoutPayout } = await import("./loans.server");
    await reconcileActiveLoansWithoutPayout();

    const loan = await prisma.loan.findUnique({
      where: { id: data.loanId },
      include: {
        product: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            idNumber: true,
            credibilityScore: true,
            loanLimit: true,
            status: true,
            createdAt: true,
          },
        },
        guarantors: {
          include: {
            guarantor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                idNumber: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        statusEvents: {
          orderBy: { createdAt: "desc" },
        },
        mpesaTransactions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!loan) {
      throw new Error("Loan not found");
    }

    const actorIds = new Set<string>();
    if (loan.approvedBy) actorIds.add(loan.approvedBy);
    loan.statusEvents.forEach((se) => {
      if (se.actorId) actorIds.add(se.actorId);
    });

    const actors = await prisma.profile.findMany({
      where: { id: { in: Array.from(actorIds) } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        roles: { select: { role: true } },
      },
    });
    const actorMap = new Map(
      actors.map((a) => [
        a.id,
        {
          id: a.id,
          firstName: a.firstName,
          lastName: a.lastName,
          email: a.email,
          role: a.roles[0]?.role ?? "staff",
        },
      ]),
    );

    const approver = loan.approvedBy ? actorMap.get(loan.approvedBy) : null;
    const approvedByObj = loan.approvedBy
      ? {
          id: loan.approvedBy,
          name: approver
            ? `${approver.firstName} ${approver.lastName}`.trim() || approver.email
            : "Admin",
          email: approver?.email ?? "",
          role: approver?.role ?? "staff",
        }
      : null;

    const { isDarajaConfigured } = await import("./mpesa.server");
    const [darajaCheck, settings] = await Promise.all([
      isDarajaConfigured(),
      prisma.businessSettings.findFirst({
        select: { allowActivationWithoutDisbursement: true },
      }),
    ]);

    return {
      id: loan.id,
      is_daraja_configured: darajaCheck.configured,
      daraja_config_reason: darajaCheck.reason ?? null,
      allow_activation_without_disbursement: Boolean(settings?.allowActivationWithoutDisbursement),
      user_id: loan.userId,
      principal: Number(loan.principal),
      interest_amount: Number(loan.interestAmount),
      processing_fee: Number(loan.processingFee),
      penalty_amount: Number(loan.penaltyAmount || 0),
      penalty_count: loan.penaltyCount || 0,
      last_penalty_applied_at: loan.lastPenaltyAppliedAt
        ? loan.lastPenaltyAppliedAt.toISOString()
        : null,
      last_overdue_reminder_at: loan.lastOverdueReminderAt
        ? loan.lastOverdueReminderAt.toISOString()
        : null,
      total_due: Number(loan.totalDue),
      amount_repaid: Number(loan.amountRepaid),
      status: loan.status,
      purpose: loan.purpose,
      disbursement_phone: loan.disbursementPhone,
      guarantors_required: loan.guarantorsRequired,
      due_date: loan.dueDate ? loan.dueDate.toISOString() : null,
      approved_at: loan.approvedAt ? loan.approvedAt.toISOString() : null,
      approved_by_user: approvedByObj,
      disbursed_at: loan.disbursedAt ? loan.disbursedAt.toISOString() : null,
      repaid_at: loan.repaidAt ? loan.repaidAt.toISOString() : null,
      rejection_reason: loan.rejectionReason,
      created_at: loan.createdAt.toISOString(),
      product: loan.product
        ? {
            id: loan.product.id,
            name: loan.product.name,
            interest_rate: Number(loan.product.interestRate),
            processing_fee_rate: Number(loan.product.processingFeeRate),
            penalty_rate:
              loan.product.penaltyRate !== undefined && loan.product.penaltyRate !== null
                ? Number(loan.product.penaltyRate)
                : 0.25,
            custom_penalty_amount:
              loan.product.customPenaltyAmount !== null &&
              loan.product.customPenaltyAmount !== undefined
                ? Number(loan.product.customPenaltyAmount)
                : null,
            term_days: loan.product.termDays,
          }
        : null,
      borrower: loan.user
        ? {
            id: loan.user.id,
            first_name: loan.user.firstName,
            last_name: loan.user.lastName,
            email: loan.user.email,
            phone: loan.user.phone,
            id_number: loan.user.idNumber,
            credibility_score: loan.user.credibilityScore,
            loan_limit: Number(loan.user.loanLimit),
            status: loan.user.status,
            created_at: loan.user.createdAt.toISOString(),
          }
        : null,
      guarantors: loan.guarantors.map((g) => ({
        id: g.id,
        loan_id: g.loanId,
        guarantor_id: g.guarantorId, // may be null — unregistered guarantor
        first_name: g.firstName || g.guarantor?.firstName || "",
        last_name: g.lastName || g.guarantor?.lastName || "",
        phone: g.phone || g.guarantor?.phone || "",
        id_number: g.idNumber || g.guarantor?.idNumber || "",
        address: g.address,
        relationship: g.guarantorId ? "Registered User" : g.relationship,
        occupation: g.occupation || "",
        is_registered_user: Boolean(g.guarantorId),
        status: g.status,
        responded_at: g.respondedAt ? g.respondedAt.toISOString() : null,
        created_at: g.createdAt.toISOString(),
      })),
      status_events: loan.statusEvents.map((se) => {
        const actor = se.actorId ? actorMap.get(se.actorId) : null;
        return {
          id: se.id,
          status: se.status,
          previous_status: se.previousStatus,
          note: se.note,
          actor_id: se.actorId,
          actor_name: actor ? `${actor.firstName} ${actor.lastName}`.trim() || actor.email : null,
          actor_role: actor ? actor.role : null,
          created_at: se.createdAt.toISOString(),
        };
      }),
      mpesa_txs: loan.mpesaTransactions.map((tx) => ({
        id: tx.id,
        kind: tx.kind,
        status: tx.status,
        amount: Number(tx.amount),
        phone: tx.phone,
        mpesa_receipt: tx.mpesaReceipt,
        created_at: tx.createdAt.toISOString(),
      })),
    };
  });

export const decideLoanGuarantor = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) =>
    z
      .object({
        loanId: z.string().uuid(),
        guarantorId: z.string().uuid(),
        approve: z.boolean(),
        reason: z.string().trim().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden");
    }

    const loanGuarantor = await prisma.loanGuarantor.findFirst({
      where: { id: data.guarantorId, loanId: data.loanId },
    });
    if (!loanGuarantor) throw new Error("Loan guarantor not found");

    const loan = await prisma.loan.findUnique({
      where: { id: data.loanId },
      include: { product: true, guarantors: true },
    });
    if (!loan) throw new Error("Loan not found");

    const gName = `${loanGuarantor.firstName} ${loanGuarantor.lastName}`.trim() || "Guarantor";

    if (data.approve) {
      await prisma.loanGuarantor.update({
        where: { id: data.guarantorId },
        data: {
          status: "accepted",
          respondedAt: new Date(),
        },
      });

      const updatedGuarantors = await prisma.loanGuarantor.findMany({
        where: { loanId: data.loanId },
      });
      const acceptedCount = updatedGuarantors.filter((g) => g.status === "accepted").length;

      let newStatus = loan.status;
      if (acceptedCount >= loan.guarantorsRequired && loan.status === "pending_guarantors") {
        newStatus = "pending_approval";
        await prisma.loan.update({
          where: { id: data.loanId },
          data: { status: "pending_approval" },
        });

        await prisma.loanStatusEvent.create({
          data: {
            loanId: data.loanId,
            status: "pending_approval",
            previousStatus: loan.status,
            actorId: userId,
            note: `Guarantor ${gName} approved. All required guarantors confirmed. Awaiting final admin approval.`,
          },
        });
      } else {
        await prisma.loanStatusEvent.create({
          data: {
            loanId: data.loanId,
            status: loan.status,
            actorId: userId,
            note: `Guarantor ${gName} approved by admin. (${acceptedCount}/${loan.guarantorsRequired} confirmed)`,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          actorId: userId,
          action: "loan_guarantor.approved_by_admin",
          targetType: "loan_guarantor",
          targetId: data.guarantorId,
          details: { loanId: data.loanId },
        },
      });

      const { syncUserCredibilityScore } = await import("./credibility.server");
      await syncUserCredibilityScore(loan.userId);

      return { ok: true as const, loanStatus: newStatus };
    } else {
      // Reject guarantor -> AUTOMATICALLY REJECT THE LOAN
      const rejectNote = data.reason
        ? `Guarantor ${gName} rejected by admin: ${data.reason}`
        : `Guarantor ${gName} rejected by admin.`;

      await prisma.loanGuarantor.update({
        where: { id: data.guarantorId },
        data: {
          status: "rejected",
          respondedAt: new Date(),
        },
      });

      await prisma.loan.update({
        where: { id: data.loanId },
        data: {
          status: "rejected",
          rejectionReason: `Loan request rejected because guarantor (${gName}) was rejected by administration.`,
        },
      });

      await prisma.loanStatusEvent.create({
        data: {
          loanId: data.loanId,
          status: "rejected",
          previousStatus: loan.status,
          actorId: userId,
          note: rejectNote,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: userId,
          action: "loan_guarantor.rejected_and_loan_rejected",
          targetType: "loan",
          targetId: data.loanId,
          details: { guarantorId: data.guarantorId, reason: data.reason },
        },
      });

      try {
        const { notifyLoanStatusChanged } = await import("./notifications.server");
        await notifyLoanStatusChanged({
          loanId: data.loanId,
          userId: loan.userId,
          status: "rejected",
          amount: Number(loan.principal),
          rejectionReason: `Your loan request was rejected because guarantor ${gName} was rejected by administration.`,
        });
      } catch (err) {
        console.error("[decideLoanGuarantor notification error]:", err);
      }

      return { ok: true as const, loanRejected: true as const };
    }
  });

export const listPublicTestimonials = createServerFn({ method: "GET" }).handler(async () => {
  const testimonials = await prisma.testimonial.findMany({
    where: { status: "approved" },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  return testimonials.map((t) => ({
    id: t.id,
    author_name: t.authorName,
    role: t.role,
    content: t.content,
    rating: t.rating,
    created_at: t.createdAt.toISOString(),
  }));
});
