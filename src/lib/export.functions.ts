import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireCustomAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";

export const getExportDataset = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator(
    z.object({
      dataset: z.enum(["loans", "users", "repayments", "guarantors", "audit_logs", "all"]),
      statusFilter: z.string().optional(),
      roleFilter: z.string().optional(),
    }),
  )
  .handler(async ({ data: input, context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden: Staff or Admin privileges required to export data.");
    }

    const { dataset, statusFilter, roleFilter } = input;

    let loansData: any[] = [];
    let usersData: any[] = [];
    let repaymentsData: any[] = [];
    let guarantorsData: any[] = [];
    let auditLogsData: any[] = [];

    // 1. LOANS DATASET
    if (dataset === "loans" || dataset === "all") {
      const whereClause: any = {};
      if (statusFilter && statusFilter !== "all") {
        whereClause.status = statusFilter;
      }

      const rawLoans = await prisma.loan.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              idNumber: true,
            },
          },
          product: {
            select: { name: true, interestRate: true, termDays: true },
          },
          guarantors: {
            select: { status: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      loansData = rawLoans.map((loan) => {
        const principal = Number(loan.principal) || 0;
        const totalDue = Number(loan.totalDue) || 0;
        const amountRepaid = Number(loan.amountRepaid) || 0;
        const balance = Math.max(0, totalDue - amountRepaid);

        const acceptedGuarantors = loan.guarantors.filter((g) => g.status === "accepted").length;
        const totalGuarantors = loan.guarantors.length;

        return {
          "Loan ID": loan.id,
          "Borrower Name":
            `${loan.user?.firstName || ""} ${loan.user?.lastName || ""}`.trim() || "N/A",
          "Borrower Phone": loan.user?.phone || loan.disbursementPhone || "N/A",
          "Borrower Email": loan.user?.email || "N/A",
          "National ID": loan.user?.idNumber || "N/A",
          "Loan Product": loan.product?.name || "N/A",
          "Principal Amount (KES)": principal,
          "Interest Fee (KES)": Number(loan.interestAmount) || 0,
          "Processing Fee (KES)": Number(loan.processingFee) || 0,
          "Total Repayable (KES)": totalDue,
          "Amount Repaid (KES)": amountRepaid,
          "Outstanding Balance (KES)": balance,
          "Loan Status": loan.status.toUpperCase(),
          "Loan Purpose": loan.purpose || "N/A",
          "Disbursement Phone": loan.disbursementPhone,
          "Guarantors Status": `${acceptedGuarantors}/${loan.guarantorsRequired} Accepted (${totalGuarantors} requested)`,
          "Approved By": loan.approvedBy || "N/A",
          "Approved At": loan.approvedAt ? new Date(loan.approvedAt).toLocaleString() : "N/A",
          "Disbursed At": loan.disbursedAt ? new Date(loan.disbursedAt).toLocaleString() : "N/A",
          "Due Date": loan.dueDate ? new Date(loan.dueDate).toLocaleDateString() : "N/A",
          "Fully Repaid At": loan.repaidAt ? new Date(loan.repaidAt).toLocaleString() : "N/A",
          "Rejection Reason": loan.rejectionReason || "N/A",
          "Application Date": new Date(loan.createdAt).toLocaleString(),
        };
      });
    }

    // 2. USERS & BORROWERS DATASET
    if (dataset === "users" || dataset === "all") {
      const whereClause: any = {};
      if (roleFilter && roleFilter !== "all") {
        whereClause.roles = {
          some: { role: roleFilter },
        };
      }

      const rawUsers = await prisma.profile.findMany({
        where: whereClause,
        include: {
          roles: { select: { role: true } },
          loans: { select: { id: true, status: true, totalDue: true, amountRepaid: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      usersData = rawUsers.map((user) => {
        const rolesList = user.roles.map((r) => r.role).join(", ") || "borrower";
        const totalLoansCount = user.loans.length;
        const activeLoansCount = user.loans.filter((l) => l.status === "active").length;
        const defaultedLoansCount = user.loans.filter((l) => l.status === "defaulted").length;

        const totalBorrowed = user.loans.reduce((acc, l) => acc + (Number(l.totalDue) || 0), 0);
        const totalPaid = user.loans.reduce((acc, l) => acc + (Number(l.amountRepaid) || 0), 0);

        return {
          "User ID": user.id,
          "First Name": user.firstName,
          "Last Name": user.lastName,
          "Full Name": `${user.firstName} ${user.lastName}`.trim(),
          Email: user.email,
          "Phone Number": user.phone || "N/A",
          "National ID": user.idNumber || "N/A",
          "Account Roles": rolesList,
          "Account Status": user.status.toUpperCase(),
          "Email Verified": user.emailVerified ? "YES" : "NO",
          "Phone Verified": user.phoneVerified ? "YES" : "NO",
          "Credibility Score": user.credibilityScore,
          "Loan Limit (KES)": Number(user.loanLimit) || 0,
          "Points Earning Frozen": user.isEarningPointsFrozen ? "YES" : "NO",
          "2FA Enabled": user.is2faEnabled ? "YES" : "NO",
          "Referral Code": user.referralCode,
          "Total Applications": totalLoansCount,
          "Active Open Loans": activeLoansCount,
          "Defaulted Loans": defaultedLoansCount,
          "Total Borrowed Value (KES)": totalBorrowed,
          "Total Repaid Value (KES)": totalPaid,
          "Registration Date": new Date(user.createdAt).toLocaleString(),
        };
      });
    }

    // 3. REPAYMENTS & MPESA TRANSACTIONS
    if (dataset === "repayments" || dataset === "all") {
      const [rawRepayments, rawMpesa] = await Promise.all([
        prisma.loanRepayment.findMany({
          include: {
            user: { select: { firstName: true, lastName: true, phone: true } },
            loan: { select: { id: true, disbursementPhone: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.mpesaTransaction.findMany({
          include: {
            user: { select: { firstName: true, lastName: true, phone: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      repaymentsData = rawRepayments.map((rep) => ({
        "Repayment ID": rep.id,
        "Loan ID": rep.loanId,
        "Borrower Name": `${rep.user?.firstName || ""} ${rep.user?.lastName || ""}`.trim() || "N/A",
        "Borrower Phone": rep.user?.phone || rep.loan?.disbursementPhone || "N/A",
        "Amount Paid (KES)": Number(rep.amount) || 0,
        "M-Pesa Receipt Number": rep.mpesaReceipt || "N/A",
        "Payment Date": new Date(rep.createdAt).toLocaleString(),
      }));

      if (dataset === "repayments") {
        // Also combine full M-Pesa transactions log if specifically requesting repayments
        const mpesaFormatted = rawMpesa.map((m) => ({
          "Transaction ID": m.id,
          "Loan ID": m.loanId || "N/A",
          "User Name": m.user ? `${m.user.firstName} ${m.user.lastName}`.trim() : "N/A",
          "Phone Number": m.phone,
          "Transaction Kind":
            m.kind === "stk_push" ? "C2B Loan Repayment" : "B2C Loan Disbursement",
          "Amount (KES)": Number(m.amount) || 0,
          "M-Pesa Receipt": m.mpesaReceipt || "N/A",
          Status: m.status.toUpperCase(),
          "Result Code": m.resultCode || "N/A",
          "Result Description": m.resultDesc || "N/A",
          Timestamp: new Date(m.createdAt).toLocaleString(),
        }));

        return {
          repayments: repaymentsData,
          mpesaTransactions: mpesaFormatted,
        };
      }
    }

    // 4. GUARANTORS DATASET
    if (dataset === "guarantors" || dataset === "all") {
      const rawGuarantors = await prisma.loanGuarantor.findMany({
        include: {
          loan: {
            include: {
              user: { select: { firstName: true, lastName: true, phone: true } },
            },
          },
          guarantor: {
            select: { firstName: true, lastName: true, phone: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      guarantorsData = rawGuarantors.map((g) => ({
        "Guarantee Request ID": g.id,
        "Loan ID": g.loanId,
        "Borrower Name": g.loan?.user
          ? `${g.loan.user.firstName} ${g.loan.user.lastName}`.trim()
          : "N/A",
        "Borrower Phone": g.loan?.user?.phone || "N/A",
        "Guarantor Name": g.guarantor
          ? `${g.guarantor.firstName} ${g.guarantor.lastName}`.trim()
          : `${g.firstName} ${g.lastName}`.trim() || "N/A",
        "Guarantor Phone": g.guarantor?.phone || g.phone || "N/A",
        "Guarantor National ID": g.idNumber || "N/A",
        Relationship: g.relationship || "N/A",
        Occupation: g.occupation || "N/A",
        "Guarantor Status": g.status.toUpperCase(),
        "Responded At": g.respondedAt
          ? new Date(g.respondedAt).toLocaleString()
          : "Pending Response",
        "Requested At": new Date(g.createdAt).toLocaleString(),
      }));
    }

    // 5. AUDIT LOGS DATASET
    if (dataset === "audit_logs" || dataset === "all") {
      const rawLogs = await prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 1000,
      });

      auditLogsData = rawLogs.map((log) => ({
        "Log ID": log.id,
        "Actor User ID": log.actorId || "System",
        Action: log.action,
        "Target Type": log.targetType || "N/A",
        "Target ID": log.targetId || "N/A",
        Details: JSON.stringify(log.details || {}),
        Timestamp: new Date(log.createdAt).toLocaleString(),
      }));
    }

    if (dataset === "all") {
      const rawMpesa = await prisma.mpesaTransaction.findMany({
        include: {
          user: { select: { firstName: true, lastName: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const mpesaFormatted = rawMpesa.map((m) => ({
        "Transaction ID": m.id,
        "Loan ID": m.loanId || "N/A",
        "User Name": m.user ? `${m.user.firstName} ${m.user.lastName}`.trim() : "N/A",
        "Phone Number": m.phone,
        "Transaction Kind": m.kind === "stk_push" ? "C2B Loan Repayment" : "B2C Loan Disbursement",
        "Amount (KES)": Number(m.amount) || 0,
        "M-Pesa Receipt": m.mpesaReceipt || "N/A",
        Status: m.status.toUpperCase(),
        "Result Code": m.resultCode || "N/A",
        "Result Description": m.resultDesc || "N/A",
        Timestamp: new Date(m.createdAt).toLocaleString(),
      }));

      const rawProducts = await prisma.loanProduct.findMany({
        orderBy: { sortOrder: "asc" },
      });

      const productsFormatted = rawProducts.map((p) => ({
        "Product ID": p.id,
        "Product Name": p.name,
        Description: p.description || "N/A",
        "Interest Rate (%)": Number(p.interestRate),
        "Interest Type": p.interestType,
        "Term (Days)": p.termDays,
        "Min Amount (KES)": Number(p.minAmount),
        "Max Amount (KES)": Number(p.maxAmount),
        Active: p.active ? "YES" : "NO",
      }));

      return {
        loans: loansData,
        users: usersData,
        repayments: repaymentsData,
        mpesaTransactions: mpesaFormatted,
        guarantors: guarantorsData,
        auditLogs: auditLogsData,
        products: productsFormatted,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      loans: loansData,
      users: usersData,
      repayments: repaymentsData,
      guarantors: guarantorsData,
      auditLogs: auditLogsData,
      timestamp: new Date().toISOString(),
    };
  });

export const getExportCounts = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { roles } = context;
    if (!roles.includes("super_admin") && !roles.includes("staff")) {
      throw new Error("Forbidden: Staff or Admin privileges required.");
    }

    const [loansCount, usersCount, repaymentsCount, mpesaCount, guarantorsCount, auditLogsCount] =
      await Promise.all([
        prisma.loan.count(),
        prisma.profile.count(),
        prisma.loanRepayment.count(),
        prisma.mpesaTransaction.count(),
        prisma.loanGuarantor.count(),
        prisma.auditLog.count(),
      ]);

    const totalCount =
      loansCount + usersCount + repaymentsCount + mpesaCount + guarantorsCount + auditLogsCount;

    return {
      loans: loansCount,
      users: usersCount,
      repayments: repaymentsCount + mpesaCount,
      guarantors: guarantorsCount,
      auditLogs: auditLogsCount,
      total: totalCount,
    };
  });
