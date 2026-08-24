import { prisma } from "@/lib/prisma";
import { sendWebPushNotification } from "./webpush.server";
import {
  sendAdminNewLoanAlert,
  sendAdminNewUserAlert,
  sendUserDueReminder,
  sendUserOverdueDefaulterReminder,
  sendUserLoanDisbursedAlert,
  sendUserLoanStatusUpdate,
  sendUserRepaymentReceipt,
} from "./email.server";

export type NotificationType =
  | "user_registered"
  | "loan_requested"
  | "loan_approved"
  | "loan_disbursed"
  | "loan_rejected"
  | "repayment_received"
  | "due_reminder"
  | "announcement"
  | "tier_update"
  | "info";

export async function createInAppNotification({
  userId,
  roleTarget,
  title,
  message,
  type = "info",
  link,
}: {
  userId?: string | null;
  roleTarget?: "admin" | "all" | "user" | null;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
}) {
  try {
    const notif = await prisma.notification.create({
      data: {
        userId: userId || null,
        roleTarget: roleTarget || null,
        title,
        message,
        type,
        link: link || null,
      },
    });

    // Automatically trigger Web Push Notification in background
    sendWebPushNotification({
      userId,
      roleTarget,
      title,
      message,
      url: link || (roleTarget === "admin" ? "/admin" : "/notifications"),
    }).catch((err) => {
      console.error("[WebPush Trigger Error]:", err);
    });

    return notif;
  } catch (err) {
    console.error("[InApp Notification Error]:", err);
    return null;
  }
}

// System Alert Notification to Admins
export async function sendSystemAlertToAdmins(
  titleOrObj: string | { title: string; message: string; link?: string },
  messageArg?: string,
  linkArg = "/admin",
) {
  let title: string;
  let message: string;
  let link: string;

  if (typeof titleOrObj === "object" && titleOrObj !== null) {
    title = titleOrObj.title;
    message = titleOrObj.message;
    link = titleOrObj.link || "/admin";
  } else {
    title = titleOrObj;
    message = messageArg || "";
    link = linkArg;
  }

  return await createInAppNotification({
    roleTarget: "admin",
    title,
    message,
    type: "info",
    link,
  });
}

// Handler: Notify Admins & Agents on Support Ticket Reply or Reopen
export async function notifyAdminSupportReply(data: {
  ticketId: string;
  subject: string;
  userName: string;
  message: string;
  isReopened?: boolean;
  previousStatus?: string;
}) {
  const title = data.isReopened
    ? `Ticket Reopened by User: ${data.subject}`
    : `User Replied to Support Ticket: ${data.subject}`;

  const message = data.isReopened
    ? `User ${data.userName} replied to previously ${data.previousStatus} ticket #${data.ticketId.slice(0, 8)}: "${data.message.slice(0, 100)}...". Ticket automatically set back to Open.`
    : `User ${data.userName} replied on ticket #${data.ticketId.slice(0, 8)}: "${data.message.slice(0, 100)}..."`;

  // 1. In-app notification for all admins & agents with permission
  await sendSystemAlertToAdmins({
    title,
    message,
    link: `/admin/support?ticketId=${data.ticketId}`,
  });

  // 2. Email alert to admin/support team
  try {
    const { sendAdminSupportTicketAlert } = await import("./email.server");
    await sendAdminSupportTicketAlert(data);
  } catch (err) {
    console.error("[sendAdminSupportTicketAlert error]:", err);
  }
}

// Handler: Notify Admins & Agents on User Account Deletion
export async function notifyUserAccountDeleted(user: {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  deletedBy?: "user" | "admin";
}) {
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
  const deleterText = user.deletedBy === "admin" ? "by an administrator" : "by the user";

  await createInAppNotification({
    roleTarget: "admin",
    title: "System Alert: Account Deleted",
    message: `Account for ${name} (${user.email}${user.phone ? `, Phone: ${user.phone}` : ""}) was deleted ${deleterText}.`,
    type: "info",
    link: "/admin/users",
  });
}

// Handler: Notify on New User Registration
export async function notifyNewUserRegistered(user: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}) {
  const name = `${user.firstName} ${user.lastName}`.trim() || user.email;

  // In-app notification for admin
  await createInAppNotification({
    roleTarget: "admin",
    title: "New Member Registration",
    message: `${name} (${user.email}) registered an account.`,
    type: "user_registered",
    link: "/admin",
  });

  // Email alert
  await sendAdminNewUserAlert({
    email: user.email,
    name,
    phone: user.phone || undefined,
  });
}

// Handler: Notify on New Loan Application
export async function notifyNewLoanRequested(loan: {
  id: string;
  userId: string;
  principal: number;
  productName: string;
}) {
  const borrower = await prisma.profile.findUnique({
    where: { id: loan.userId },
    select: { firstName: true, lastName: true, email: true },
  });

  const borrowerName = borrower ? `${borrower.firstName} ${borrower.lastName}`.trim() : "Member";

  // In-app for borrower
  await createInAppNotification({
    userId: loan.userId,
    title: "Loan Application Received",
    message: `Your application for a ${loan.productName} loan of KES ${loan.principal.toLocaleString()} is being reviewed.`,
    type: "loan_requested",
    link: "/loans",
  });

  // In-app for admins
  await createInAppNotification({
    roleTarget: "admin",
    title: "New Loan Application",
    message: `${borrowerName} submitted a ${loan.productName} loan request for KES ${loan.principal.toLocaleString()}.`,
    type: "loan_requested",
    link: "/admin",
  });

  // Email to admin
  await sendAdminNewLoanAlert({
    loanId: loan.id,
    borrowerName,
    principal: loan.principal,
    productName: loan.productName,
  });
}

// Handler: Notify on Loan Status Decision (Approved / Rejected)
export async function notifyLoanStatusChanged(data: {
  loanId: string;
  userId: string;
  status: string;
  amount: number;
  rejectionReason?: string;
}) {
  const user = await prisma.profile.findUnique({
    where: { id: data.userId },
    select: { firstName: true, lastName: true, email: true },
  });

  if (!user) return;
  const userName = `${user.firstName} ${user.lastName}`.trim() || user.email;

  const isApproved = data.status === "approved" || data.status === "active";
  const title = isApproved ? "Loan Application Approved!" : "Loan Application Status";
  const message = isApproved
    ? `Congratulations! Your loan of KES ${data.amount.toLocaleString()} was approved.`
    : `Your loan request for KES ${data.amount.toLocaleString()} was not approved.${data.rejectionReason ? ` Reason: ${data.rejectionReason}` : ""}`;

  await createInAppNotification({
    userId: data.userId,
    title,
    message,
    type: isApproved ? "loan_approved" : "loan_rejected",
    link: "/loans",
  });

  await sendUserLoanStatusUpdate({
    userEmail: user.email,
    userName,
    loanId: data.loanId,
    status: data.status,
    amount: data.amount,
    rejectionReason: data.rejectionReason,
  });
}

// Handler: Notify on Disbursement Success
export async function notifyLoanDisbursed(data: {
  loanId: string;
  userId: string;
  amount: number;
  mpesaReceipt?: string;
  dueDate?: Date | null;
}) {
  const user = await prisma.profile.findUnique({
    where: { id: data.userId },
    select: { firstName: true, lastName: true, email: true },
  });
  if (!user) return;

  const userName = `${user.firstName} ${user.lastName}`.trim() || user.email;
  const dueDateStr = data.dueDate ? new Date(data.dueDate).toLocaleDateString("en-KE") : undefined;

  await createInAppNotification({
    userId: data.userId,
    title: "Loan Funds Disbursed",
    message: `KES ${data.amount.toLocaleString()} has been disbursed to your M-Pesa line.${data.mpesaReceipt ? ` Ref: ${data.mpesaReceipt}` : ""}`,
    type: "loan_disbursed",
    link: "/loans",
  });

  await sendUserLoanDisbursedAlert({
    userEmail: user.email,
    userName,
    amount: data.amount,
    mpesaReceipt: data.mpesaReceipt,
    dueDate: dueDateStr,
  });
}

// Handler: Notify on Repayment Received
export async function notifyRepaymentReceived(data: {
  loanId: string;
  userId: string;
  amount: number;
  mpesaReceipt?: string;
  totalRemaining: number;
  isFullyRepaid: boolean;
}) {
  const user = await prisma.profile.findUnique({
    where: { id: data.userId },
    select: { firstName: true, lastName: true, email: true },
  });
  if (!user) return;

  const userName = `${user.firstName} ${user.lastName}`.trim() || user.email;

  const title = data.isFullyRepaid ? "Loan Fully Settled!" : "Repayment Received";
  const message = data.isFullyRepaid
    ? `Your repayment of KES ${data.amount.toLocaleString()} settled your loan completely. Thank you!`
    : `Received KES ${data.amount.toLocaleString()}. Remaining balance: KES ${data.totalRemaining.toLocaleString()}.`;

  // Notify borrower
  await createInAppNotification({
    userId: data.userId,
    title,
    message,
    type: "repayment_received",
    link: "/loans",
  });

  // Notify admin
  await createInAppNotification({
    roleTarget: "admin",
    title: `Repayment Received (${userName})`,
    message: `Received KES ${data.amount.toLocaleString()} for loan ref ${data.loanId.slice(0, 8)}.${data.mpesaReceipt ? ` M-Pesa: ${data.mpesaReceipt}` : ""}`,
    type: "repayment_received",
    link: "/admin",
  });

  // Send email
  await sendUserRepaymentReceipt({
    userEmail: user.email,
    userName,
    amount: data.amount,
    mpesaReceipt: data.mpesaReceipt,
    totalRemaining: data.totalRemaining,
    isFullyRepaid: data.isFullyRepaid,
  });
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface OverdueReminderResult {
  totalDefaultersChecked: number;
  remindersDispatched: number;
  skippedWithin24h: number;
  details: Array<{
    loanId: string;
    borrowerName: string;
    borrowerEmail: string;
    daysOverdue: number;
    outstandingBalance: number;
    reminded: boolean;
    reason?: string;
  }>;
}

// 24-Hour Overdue Defaulter Reminder Dispatcher
export async function send24HourOverdueDefaulterReminders(options?: {
  forceAll?: boolean;
}): Promise<OverdueReminderResult> {
  const now = new Date();

  // Find all loans with status 'defaulted'
  const overdueLoans = await prisma.loan.findMany({
    where: {
      status: "defaulted",
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      },
      product: {
        select: { id: true, name: true, penaltyRate: true },
      },
    },
  });

  // Also include active loans that have passed due date (in case not yet transitioned)
  const activeOverdueLoans = await prisma.loan.findMany({
    where: {
      status: "active",
      dueDate: { lt: now },
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      },
      product: {
        select: { id: true, name: true, penaltyRate: true },
      },
    },
  });

  // Deduplicate by loan ID
  const allDefaulterLoansMap = new Map<string, any>();
  for (const l of [...overdueLoans, ...activeOverdueLoans]) {
    allDefaulterLoansMap.set(l.id, l);
  }
  const allDefaulterLoans = Array.from(allDefaulterLoansMap.values());

  let remindersDispatched = 0;
  let skippedWithin24h = 0;
  const details: OverdueReminderResult["details"] = [];

  for (const loan of allDefaulterLoans) {
    if (!loan.user) continue;

    const totalDue = Number(loan.totalDue || 0);
    const amountRepaid = Number(loan.amountRepaid || 0);
    const principal = Number(loan.principal || 0);
    const penaltyAmount = Number(loan.penaltyAmount || 0);
    const remaining = totalDue - amountRepaid;

    // If fully settled, no overdue reminder needed
    if (remaining <= 0) continue;

    const dueDate = loan.dueDate ? new Date(loan.dueDate) : new Date(loan.createdAt);
    const overdueMs = Math.max(0, now.getTime() - dueDate.getTime());
    const daysOverdue = Math.max(1, Math.floor(overdueMs / MS_PER_DAY));
    const dueDateStr = dueDate.toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const userName =
      `${loan.user.firstName || ""} ${loan.user.lastName || ""}`.trim() || loan.user.email;

    // Check 24-hour interval logic:
    // A reminder is due if it was never sent (lastOverdueReminderAt is null)
    // OR if at least 24 hours (MS_PER_DAY) has elapsed since lastOverdueReminderAt.
    const lastReminder = loan.lastOverdueReminderAt ? new Date(loan.lastOverdueReminderAt) : null;
    const msSinceLastReminder = lastReminder ? now.getTime() - lastReminder.getTime() : Infinity;

    if (!options?.forceAll && msSinceLastReminder < MS_PER_DAY) {
      skippedWithin24h++;
      const hoursRemaining = Math.ceil((MS_PER_DAY - msSinceLastReminder) / (60 * 60 * 1000));
      details.push({
        loanId: loan.id,
        borrowerName: userName,
        borrowerEmail: loan.user.email,
        daysOverdue,
        outstandingBalance: remaining,
        reminded: false,
        reason: `Last reminder sent ${Math.floor(msSinceLastReminder / (60 * 60 * 1000))}h ago. Next 24h cycle in ~${hoursRemaining}h.`,
      });
      continue;
    }

    // 1. Create In-App Notification & Real-Time Push
    await createInAppNotification({
      userId: loan.user.id,
      title: `24-Hour Overdue Notice: Loan #${loan.id.slice(0, 8).toUpperCase()}`,
      message: `Your loan of KES ${principal.toLocaleString()} is ${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue (Status: DEFAULTED). Outstanding balance: KES ${remaining.toLocaleString()}${penaltyAmount > 0 ? ` (includes KES ${penaltyAmount.toLocaleString()} default penalties)` : ""}. Please make an immediate M-Pesa repayment to prevent further 24hr default penalties.`,
      type: "due_reminder",
      link: "/loans",
    });

    // 2. Dispatch High-Priority Email Reminder
    await sendUserOverdueDefaulterReminder({
      userEmail: loan.user.email,
      userName,
      loanId: loan.id,
      principal,
      totalDue,
      amountRepaid,
      amountDue: remaining,
      penaltyAmount,
      penaltyCount: loan.penaltyCount,
      daysOverdue,
      dueDateStr,
    });

    // 3. Update loan record with lastOverdueReminderAt timestamp
    await prisma.loan.update({
      where: { id: loan.id },
      data: {
        lastOverdueReminderAt: now,
      },
    });

    // 4. Log status event for audit trail
    try {
      await prisma.loanStatusEvent.create({
        data: {
          loanId: loan.id,
          actorId: null,
          status: "defaulted",
          note: `24-hour recurring overdue reminder sent to borrower (Email & In-App Notice). Overdue: ${daysOverdue} day(s), Balance: KES ${remaining.toLocaleString()}.`,
        },
      });
    } catch {
      // ignore status event error if table constrained
    }

    remindersDispatched++;
    details.push({
      loanId: loan.id,
      borrowerName: userName,
      borrowerEmail: loan.user.email,
      daysOverdue,
      outstandingBalance: remaining,
      reminded: true,
      reason: "24-hour overdue reminder dispatched successfully.",
    });
  }

  return {
    totalDefaultersChecked: allDefaulterLoans.length,
    remindersDispatched,
    skippedWithin24h,
    details,
  };
}

// Automatic Due Date & 24hr Overdue Scanner & Reminder Trigger
export async function scanAndSendDueReminders(options?: { forceDefaulters?: boolean }) {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // 1. Process 24-Hour Overdue Defaulter Reminders
  const overdueResult = await send24HourOverdueDefaulterReminders({
    forceAll: options?.forceDefaulters,
  });

  // 2. Find active loans due within the next 24 hours (not yet overdue)
  const activeUpcomingLoans = await prisma.loan.findMany({
    where: {
      status: "active",
      dueDate: { gte: now, lte: tomorrow },
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  let upcomingCount = 0;
  for (const loan of activeUpcomingLoans) {
    if (!loan.dueDate || !loan.user) continue;

    const remaining = Number(loan.totalDue) - Number(loan.amountRepaid);
    if (remaining <= 0) continue;

    const dueMs = new Date(loan.dueDate).getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(dueMs / (1000 * 60 * 60 * 24)));

    const userName =
      `${loan.user.firstName || ""} ${loan.user.lastName || ""}`.trim() || loan.user.email;
    const dueDateStr = new Date(loan.dueDate).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    // Create in-app notification
    await createInAppNotification({
      userId: loan.user.id,
      title: "Upcoming Loan Repayment Due",
      message: `Your loan payment of KES ${remaining.toLocaleString()} is due on ${dueDateStr} (${daysLeft === 0 ? "today" : `in ${daysLeft} day(s)`}).`,
      type: "due_reminder",
      link: "/loans",
    });

    // Send email
    await sendUserDueReminder({
      userEmail: loan.user.email,
      userName,
      loanId: loan.id,
      amountDue: remaining,
      dueDateStr,
      daysLeft,
    });

    upcomingCount++;
  }

  return {
    scanned: activeUpcomingLoans.length + overdueResult.totalDefaultersChecked,
    upcomingRemindersSent: upcomingCount,
    overdueDefaulterRemindersSent: overdueResult.remindersDispatched,
    overdueDefaultersSkippedWithin24h: overdueResult.skippedWithin24h,
    totalRemindersSent: upcomingCount + overdueResult.remindersDispatched,
    overdueDetails: overdueResult.details,
  };
}
