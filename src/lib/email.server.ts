import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  secure: boolean;
};

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const settings = await prisma.businessSettings.findFirst({
    select: {
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      smtpPass: true,
      smtpFromEmail: true,
      smtpFromName: true,
      smtpSecure: true,
      businessName: true,
      supportEmail: true,
    },
  });

  const host = settings?.smtpHost || process.env["SMTP_HOST"];
  const port = settings?.smtpPort || Number(process.env["SMTP_PORT"]) || 587;
  const user = settings?.smtpUser || process.env["SMTP_USER"];
  const pass = settings?.smtpPass || process.env["SMTP_PASS"];
  const fromEmail =
    settings?.smtpFromEmail || process.env["SMTP_FROM_EMAIL"] || settings?.supportEmail || user;
  const fromName =
    settings?.smtpFromName ||
    process.env["SMTP_FROM_NAME"] ||
    settings?.businessName ||
    process.env["BUSINESS_NAME"] ||
    "Lending Platform";
  const secure = settings?.smtpSecure ?? port === 465;

  if (!host || !user || !pass || !fromEmail) {
    return null;
  }

  return {
    host,
    port,
    user,
    pass,
    fromEmail,
    fromName,
    secure,
  };
}

export async function createEmailTransporter(configOverride?: SmtpConfig) {
  const config = configOverride || (await getSmtpConfig());
  if (!config) return null;

  return {
    transporter: nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    }),
    from: `"${config.fromName}" <${config.fromEmail}>`,
  };
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  configOverride,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  configOverride?: SmtpConfig;
}) {
  try {
    const client = await createEmailTransporter(configOverride);
    if (!client) {
      console.warn("[Email Server] SMTP credentials not configured. Skipping email send to:", to);
      return { sent: false, reason: "SMTP not configured" };
    }

    const info = await client.transporter.sendMail({
      from: client.from,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ""),
    });

    console.log("[Email Server] Email sent successfully:", info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error("[Email Server] Failed to send email:", err);
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Layout Wrapper for Professional HTML Email Templates
function renderEmailWrapper(title: string, bodyContent: string, businessNameOverride?: string) {
  const bName = businessNameOverride || "Lending Platform";
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f4f5f7; margin: 0; padding: 20px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background-color: #0f172a; color: #ffffff; padding: 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
          .content { padding: 32px 24px; line-height: 1.6; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px; }
          .badge-success { background: #dcfce7; color: #166534; }
          .badge-warning { background: #fef3c7; color: #92400e; }
          .badge-info { background: #e0f2fe; color: #075985; }
          .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 600; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px; }
          .footer { background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${bName}</h1>
          </div>
          <div class="content">
            <h2 style="margin-top:0; font-size:18px; color:#0f172a;">${title}</h2>
            ${bodyContent}
          </div>
          <div class="footer">
            <p>You are receiving this official message from ${bName}.</p>
            <p>© ${new Date().getFullYear()} ${bName}. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function getActiveBusinessName(): Promise<string> {
  try {
    const settings = await prisma.businessSettings.findFirst({
      select: { businessName: true },
    });
    return settings?.businessName || process.env["BUSINESS_NAME"] || "Lending Platform";
  } catch {
    return process.env["BUSINESS_NAME"] || "Lending Platform";
  }
}

// 0. User Alert: Email Verification Code
export async function sendEmailVerificationCode(data: {
  email: string;
  name: string;
  code: string;
}) {
  const bName = await getActiveBusinessName();
  const html = renderEmailWrapper(
    "Verify Your Email Address",
    `
    <span class="badge badge-info">Account Verification</span>
    <p>Dear ${data.name},</p>
    <p>Thank you for registering with <strong>${bName}</strong>. To complete your account registration and activate your borrower profile, please enter the 6-digit verification code below:</p>
    <div style="text-align: center; margin: 28px 0;">
      <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #2563eb; background: #eff6ff; padding: 14px 28px; border-radius: 8px; display: inline-block; border: 1px solid #bfdbfe;">
        ${data.code}
      </span>
    </div>
    <p style="color: #64748b; font-size: 13px;">This verification code is valid for <strong>15 minutes</strong>. If you did not create an account on ${bName}, you can safely disregard this message.</p>
  `,
    bName,
  );

  return sendEmail({
    to: data.email,
    subject: `${bName}: Your 6-Digit Email Verification Code is ${data.code}`,
    html,
  });
}

// 1. Admin Alert: New User Registration
export async function sendAdminNewUserAlert(user: { email: string; name: string; phone?: string }) {
  const settings = await prisma.businessSettings.findFirst({
    select: { supportEmail: true, businessName: true },
  });
  const adminEmail = settings?.supportEmail || process.env["SMTP_FROM_EMAIL"];
  if (!adminEmail) return;

  const bName = settings?.businessName || (await getActiveBusinessName());

  const html = renderEmailWrapper(
    "New Member Registration",
    `
    <p>A new member has successfully created an account on the ${bName} platform.</p>
    <ul>
      <li><strong>Member Name:</strong> ${user.name}</li>
      <li><strong>Email:</strong> ${user.email}</li>
      <li><strong>Phone:</strong> ${user.phone || "Not provided"}</li>
    </ul>
    <p>You can review user details and set credit limits in the admin panel.</p>
  `,
    bName,
  );

  return sendEmail({
    to: adminEmail,
    subject: `[Admin Alert] New Member Registered: ${user.name}`,
    html,
  });
}

// 2. Admin Alert: Support Ticket
export async function sendAdminSupportTicketAlert(data: {
  ticketId: string;
  subject: string;
  userName: string;
  message: string;
  isReopened?: boolean;
  previousStatus?: string;
}) {
  const settings = await prisma.businessSettings.findFirst({
    select: { supportEmail: true, businessName: true },
  });
  const adminEmail = settings?.supportEmail || process.env["SMTP_FROM_EMAIL"];
  if (!adminEmail) return;

  const bName = settings?.businessName || (await getActiveBusinessName());

  const title = data.isReopened
    ? `Ticket Reopened by User: ${data.subject}`
    : `New User Reply on Support Ticket: ${data.subject}`;

  const html = renderEmailWrapper(
    title,
    `
    <p>User <strong>${data.userName}</strong> has replied to support ticket <code>#${data.ticketId.slice(0, 8)}</code>.</p>
    ${
      data.isReopened
        ? `<p style="color:#92400e; font-weight:600; background:#fef3c7; padding:8px 12px; border-radius:6px;">This ticket was previously marked as <em>${data.previousStatus}</em> and has been automatically turned back to <strong>OPEN</strong>.</p>`
        : ""
    }
    <div style="background:#f8fafc; border-left:4px solid #2563eb; padding:12px 16px; margin:16px 0; font-style:italic;">
      "${data.message}"
    </div>
    <p>Log in to the ${bName} Staff Portal to respond to this ticket.</p>
  `,
    bName,
  );

  return sendEmail({
    to: adminEmail,
    subject: `[Admin Alert] ${title}`,
    html,
  });
}

// 2b. Admin Alert: New Loan Request
export async function sendAdminNewLoanAlert(loan: {
  loanId: string;
  borrowerName: string;
  principal: number;
  productName: string;
}) {
  const settings = await prisma.businessSettings.findFirst({
    select: { supportEmail: true, businessName: true },
  });
  const adminEmail = settings?.supportEmail || process.env["SMTP_FROM_EMAIL"];
  if (!adminEmail) return;

  const bName = settings?.businessName || (await getActiveBusinessName());

  const html = renderEmailWrapper(
    "New Loan Application Submitted",
    `
    <p><strong>${loan.borrowerName}</strong> has requested a new loan.</p>
    <ul>
      <li><strong>Loan Tier:</strong> ${loan.productName}</li>
      <li><strong>Principal Amount:</strong> KES ${loan.principal.toLocaleString()}</li>
      <li><strong>Loan Reference ID:</strong> <code>${loan.loanId}</code></li>
    </ul>
    <p>Please log into the ${bName} staff portal to review guarantors and approve disbursement.</p>
  `,
    bName,
  );

  return sendEmail({
    to: adminEmail,
    subject: `[Admin Alert] New Loan Application: KES ${loan.principal.toLocaleString()} (${loan.borrowerName})`,
    html,
  });
}

// 3. User Alert: Loan Application Status Update (Approved, Rejected, etc)
export async function sendUserLoanStatusUpdate(data: {
  userEmail: string;
  userName: string;
  loanId: string;
  status: string;
  amount: number;
  rejectionReason?: string;
}) {
  const bName = await getActiveBusinessName();
  let badge = `<span class="badge badge-info">${data.status.replace("_", " ")}</span>`;
  let title = "Loan Application Update";
  let body = "";

  if (data.status === "approved" || data.status === "active") {
    badge = `<span class="badge badge-success">APPROVED</span>`;
    title = "Your Loan Application Has Been Approved!";
    body = `
      <p>Dear ${data.userName},</p>
      <p>Great news! Your loan application for <strong>KES ${data.amount.toLocaleString()}</strong> has been approved.</p>
      <p>Disbursement to your M-Pesa phone number will be processed shortly.</p>
    `;
  } else if (data.status === "rejected") {
    badge = `<span class="badge badge-warning">REJECTED</span>`;
    title = "Loan Application Update";
    body = `
      <p>Dear ${data.userName},</p>
      <p>We regret to inform you that your loan application for <strong>KES ${data.amount.toLocaleString()}</strong> was not approved at this time.</p>
      ${data.rejectionReason ? `<p><strong>Reason:</strong> ${data.rejectionReason}</p>` : ""}
      <p>You can improve your credibility score by making consistent savings or updating guarantor information and try again.</p>
    `;
  } else {
    body = `<p>Dear ${data.userName}, your loan status has been updated to <strong>${data.status}</strong>.</p>`;
  }

  const html = renderEmailWrapper(title, `${badge}${body}`, bName);

  return sendEmail({
    to: data.userEmail,
    subject: `${bName}: ${title}`,
    html,
  });
}

// 4. User Alert: M-Pesa Loan Disbursement Successful
export async function sendUserLoanDisbursedAlert(data: {
  userEmail: string;
  userName: string;
  amount: number;
  mpesaReceipt?: string;
  dueDate?: string;
}) {
  const bName = await getActiveBusinessName();
  const html = renderEmailWrapper(
    "M-Pesa Loan Funds Disbursed!",
    `
    <span class="badge badge-success">DISBURSED</span>
    <p>Dear ${data.userName},</p>
    <p>Your loan of <strong>KES ${data.amount.toLocaleString()}</strong> has been successfully sent to your M-Pesa line.</p>
    <ul>
      ${data.mpesaReceipt ? `<li><strong>M-Pesa Receipt Ref:</strong> <code>${data.mpesaReceipt}</code></li>` : ""}
      ${data.dueDate ? `<li><strong>Repayment Due Date:</strong> ${data.dueDate}</li>` : ""}
    </ul>
    <p>Thank you for choosing ${bName}!</p>
  `,
    bName,
  );

  return sendEmail({
    to: data.userEmail,
    subject: `${bName}: KES ${data.amount.toLocaleString()} Disbursed to M-Pesa`,
    html,
  });
}

// 5. User Alert: Repayment Received Confirmation
export async function sendUserRepaymentReceipt(data: {
  userEmail: string;
  userName: string;
  amount: number;
  mpesaReceipt?: string;
  totalRemaining: number;
  isFullyRepaid: boolean;
}) {
  const bName = await getActiveBusinessName();
  const statusBadge = data.isFullyRepaid
    ? `<span class="badge badge-success">FULLY REPAID</span>`
    : `<span class="badge badge-info">PARTIAL PAYMENT</span>`;

  const html = renderEmailWrapper(
    "Loan Repayment Received",
    `
    ${statusBadge}
    <p>Dear ${data.userName},</p>
    <p>We have received your payment of <strong>KES ${data.amount.toLocaleString()}</strong>.</p>
    <ul>
      ${data.mpesaReceipt ? `<li><strong>M-Pesa Receipt:</strong> <code>${data.mpesaReceipt}</code></li>` : ""}
      <li><strong>Remaining Balance:</strong> KES ${data.totalRemaining.toLocaleString()}</li>
    </ul>
    ${
      data.isFullyRepaid
        ? `<p style="color:#166534; font-weight:600;">Congratulations! Your loan has been fully settled. Your credibility score has been boosted!</p>`
        : `<p>Thank you for keeping up with your repayment schedule.</p>`
    }
  `,
    bName,
  );

  return sendEmail({
    to: data.userEmail,
    subject: `${bName} Repayment Confirmation: KES ${data.amount.toLocaleString()} Received`,
    html,
  });
}

// 6. User Alert: Payment Due Reminder
export async function sendUserDueReminder(data: {
  userEmail: string;
  userName: string;
  loanId: string;
  amountDue: number;
  dueDateStr: string;
  daysLeft: number;
}) {
  const bName = await getActiveBusinessName();
  const isOverdue = data.daysLeft < 0;
  const isOneDayBefore = data.daysLeft === 1 || data.daysLeft === 0;

  let title = `Reminder: Loan Payment Due in ${data.daysLeft} Day(s)`;
  let badge = `<span class="badge badge-warning">DUE SOON</span>`;

  if (isOverdue) {
    title = `URGENT: Your ${bName} Loan Payment is Overdue`;
    badge = `<span class="badge badge-warning" style="background:#fee2e2; color:#991b1b;">OVERDUE</span>`;
  } else if (isOneDayBefore) {
    title = `Important: Your ${bName} Loan Payment is Due Tomorrow`;
  }

  const html = renderEmailWrapper(
    title,
    `
    ${badge}
    <p>Dear ${data.userName},</p>
    <p>${
      isOverdue
        ? `Your loan balance of <strong>KES ${data.amountDue.toLocaleString()}</strong> was due on ${data.dueDateStr} and is currently overdue.`
        : `This is a friendly reminder that your loan balance of <strong>KES ${data.amountDue.toLocaleString()}</strong> is due on <strong>${data.dueDateStr}</strong>.`
    }</p>
    <p>Timely repayments ensure your credit score remains high and unlocks higher borrowing tiers for your future needs.</p>
    <p>You can settle your loan via M-Pesa directly in your ${bName} member dashboard.</p>
  `,
    bName,
  );

  return sendEmail({
    to: data.userEmail,
    subject: `${bName}: ${title}`,
    html,
  });
}

// 7. General Broadcast / News Email
export async function sendBroadcastEmail(data: {
  recipients: string[];
  subject: string;
  bodyContent: string;
  configOverride?: SmtpConfig;
}) {
  const bName = await getActiveBusinessName();
  const html = renderEmailWrapper(data.subject, data.bodyContent, bName);

  return sendEmail({
    to: data.recipients,
    subject: data.subject,
    html,
    configOverride: data.configOverride as SmtpConfig,
  });
}

// 8. Custom Admin / Agent Email to User with Official Signature
export async function sendCustomUserEmailFromAdmin(data: {
  recipientEmail: string;
  recipientName: string;
  title: string;
  reason: string;
  bodyContent: string;
  senderName: string;
  senderEmail: string;
  senderRole?: string;
  websiteUrl?: string;
  businessName?: string;
}) {
  const settings = await prisma.businessSettings.findFirst({
    select: {
      businessName: true,
      supportEmail: true,
      supportPhone: true,
    },
  });

  const bName = data.businessName || settings?.businessName || (await getActiveBusinessName());
  const webUrl =
    data.websiteUrl ||
    process.env["APP_URL"] ||
    (typeof window !== "undefined" ? window.location.origin : "/");

  const formattedParagraphs = data.bodyContent
    .split("\n")
    .filter((p) => p.trim().length > 0)
    .map(
      (p) =>
        `<p style="margin: 0 0 14px 0; font-size: 15px; line-height: 1.65; color: #334155;">${p}</p>`,
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px 12px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background-color: #0f172a; color: #ffffff; padding: 24px 28px; text-align: left; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px; }
          .header p { margin: 4px 0 0 0; font-size: 12px; color: #94a3b8; }
          .content { padding: 28px; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; background: #e0f2fe; color: #0369a1; margin-bottom: 16px; letter-spacing: 0.5px; }
          .email-title { margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3; }
          .reason-box { background: #f8fafc; border-left: 4px solid #2563eb; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px; }
          .reason-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px; letter-spacing: 0.5px; }
          .reason-text { font-size: 14px; font-weight: 600; color: #0f172a; margin: 0; }
          .greeting { font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 14px; }
          .body-content { margin: 20px 0; }
          .signature-card { margin-top: 32px; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; }
          .signature-header { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 12px; letter-spacing: 0.5px; }
          .signature-name { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 2px 0; }
          .signature-role { font-size: 13px; color: #64748b; margin: 0 0 10px 0; }
          .signature-meta { font-size: 13px; color: #334155; margin: 4px 0; }
          .signature-meta strong { color: #0f172a; }
          .signature-link { color: #2563eb; text-decoration: none; font-weight: 500; }
          .signature-link:hover { text-decoration: underline; }
          .footer { background-color: #f8fafc; padding: 16px 28px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${bName}</h1>
            <p>Official Direct Communication</p>
          </div>
          <div class="content">
            <div class="badge">Official Notice</div>
            <h2 class="email-title">${data.title}</h2>

            <div class="reason-box">
              <div class="reason-label">Reason for this Email:</div>
              <p class="reason-text">${data.reason}</p>
            </div>

            <div class="body-content">
              <div class="greeting">Hello ${data.recipientName},</div>
              ${formattedParagraphs}
            </div>

            <div class="signature-card">
              <div class="signature-header">Official Sign-off & Contact Signature</div>
              <div class="signature-name">${data.senderName}</div>
              <div class="signature-role">${data.senderRole || "Operational Staff / Administrator"} · ${bName}</div>
              <div class="signature-meta"><strong>Direct Email:</strong> <a href="mailto:${data.senderEmail}" class="signature-link">${data.senderEmail}</a></div>
              <div class="signature-meta"><strong>Official Website:</strong> <a href="${webUrl}" class="signature-link" target="_blank">${webUrl}</a></div>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0 0 4px 0;">This email was dispatched by an authorized representative from ${bName}.</p>
            <p style="margin: 0;">© ${new Date().getFullYear()} ${bName}. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: data.recipientEmail,
    subject: `[${bName}] ${data.title}`,
    html,
  });
}
