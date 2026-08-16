import { normalizePhone } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export interface MpesaConfig {
  environment: "sandbox" | "production";
  shortcode: string;
  passkey: string;
  consumerKey: string;
  consumerSecret: string;
  initiatorName: string;
  securityCredential: string;
  callbackBase: string;
}

export function baseUrl(environment: string) {
  return environment === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

export interface DarajaRow {
  environment: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  initiatorName: string;
  securityCredential: string;
}

export async function loadDarajaCredentials(): Promise<DarajaRow | null> {
  const row = await prisma.darajaCredentials.findFirst({
    select: {
      environment: true,
      consumerKey: true,
      consumerSecret: true,
      passkey: true,
      initiatorName: true,
      securityCredential: true,
    },
  });
  if (!row) return null;
  return row;
}

export function hasDbCredentials(row: DarajaRow | null): boolean {
  if (!row) return false;
  return Boolean(row.consumerKey && row.consumerSecret && row.passkey);
}

export async function isDarajaConfigured(): Promise<{ configured: boolean; reason?: string }> {
  const daraja = await loadDarajaCredentials();
  if (hasDbCredentials(daraja)) {
    return { configured: true };
  }
  const consumerKey = process.env["MPESA_CONSUMER_KEY"];
  const consumerSecret = process.env["MPESA_CONSUMER_SECRET"];
  const passkey = process.env["MPESA_PASSKEY"];
  if (consumerKey && consumerSecret && passkey) {
    return { configured: true };
  }
  return {
    configured: false,
    reason:
      "Safaricom Daraja API credentials (Consumer Key, Consumer Secret, and Passkey) are not set.",
  };
}

export function readEnvConfig(overrides: {
  environment: string;
  shortcode: string | null;
  callbackBase: string;
}): MpesaConfig {
  const consumerKey = process.env["MPESA_CONSUMER_KEY"];
  const consumerSecret = process.env["MPESA_CONSUMER_SECRET"];
  const passkey = process.env["MPESA_PASSKEY"];
  if (!consumerKey || !consumerSecret || !passkey) {
    throw new Error("M-Pesa credentials are not configured yet.");
  }
  if (!overrides.shortcode) throw new Error("Business M-Pesa shortcode is missing.");
  return {
    environment: overrides.environment === "production" ? "production" : "sandbox",
    shortcode: overrides.shortcode,
    passkey,
    consumerKey,
    consumerSecret,
    initiatorName: process.env["MPESA_INITIATOR_NAME"] ?? "testapi",
    securityCredential: process.env["MPESA_SECURITY_CREDENTIAL"] ?? "",
    callbackBase: overrides.callbackBase.replace(/\/$/, ""),
  };
}

export function buildConfig(
  row: DarajaRow,
  overrides: { environment: string; shortcode: string; callbackBase: string },
): MpesaConfig {
  return {
    environment: row.environment === "production" ? "production" : "sandbox",
    shortcode: overrides.shortcode,
    passkey: row.passkey,
    consumerKey: row.consumerKey,
    consumerSecret: row.consumerSecret,
    initiatorName: row.initiatorName || "testapi",
    securityCredential: row.securityCredential,
    callbackBase: overrides.callbackBase.replace(/\/$/, ""),
  };
}

async function accessToken(config: MpesaConfig): Promise<string> {
  const basic = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const res = await fetch(
    `${baseUrl(config.environment)}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${basic}` } },
  );
  const body = (await res.json()) as { access_token?: string; errorMessage?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(body.errorMessage ?? "Could not authenticate with M-Pesa.");
  }
  return body.access_token;
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

export interface StkPushResult {
  ok: boolean;
  checkoutRequestId?: string | undefined;
  merchantRequestId?: string | undefined;
  message: string;
  raw: unknown;
}

/** Customer-to-business (C2B Express STK Push) collection prompt used for repayments. */
export async function stkPush(
  config: MpesaConfig,
  input: { phone: string; amount: number; reference: string; description: string },
): Promise<StkPushResult> {
  const token = await accessToken(config);
  const ts = timestamp();
  const password = Buffer.from(`${config.shortcode}${config.passkey}${ts}`).toString("base64");
  const phone = normalizePhone(input.phone);

  const res = await fetch(`${baseUrl(config.environment)}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: String(Math.round(input.amount)),
      PartyA: phone,
      PartyB: config.shortcode,
      PhoneNumber: phone,
      CallBackURL: `${config.callbackBase}/api/public/mpesa/stk-callback`,
      AccountReference: input.reference.slice(0, 12),
      TransactionDesc: input.description.slice(0, 60),
    }),
  });
  const raw = (await res.json()) as Record<string, unknown>;
  const ok = res.ok && String(raw["ResponseCode"] ?? "") === "0";
  return {
    ok,
    checkoutRequestId: raw["CheckoutRequestID"] as string | undefined,
    merchantRequestId: raw["MerchantRequestID"] as string | undefined,
    message:
      (raw["ResponseDescription"] as string) ??
      (raw["CustomerMessage"] as string) ??
      (raw["errorMessage"] as string) ??
      "M-Pesa request failed.",
    raw,
  };
}

export interface B2cResult {
  ok: boolean;
  conversationId?: string | undefined;
  originatorConversationId?: string | undefined;
  message: string;
  raw: unknown;
}

/** Business-to-customer (B2C v3) payout used for loan disbursement. */
export async function b2cPayout(
  config: MpesaConfig,
  input: { phone: string; amount: number; remarks: string; occasion: string },
): Promise<B2cResult> {
  const token = await accessToken(config);
  const phone = normalizePhone(input.phone);
  const originatorConversationId = `${config.shortcode}_B2C_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  const res = await fetch(`${baseUrl(config.environment)}/mpesa/b2c/v3/paymentrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      OriginatorConversationID: originatorConversationId,
      InitiatorName: config.initiatorName,
      SecurityCredential: config.securityCredential,
      CommandID: "BusinessPayment",
      Amount: String(Math.round(input.amount)),
      PartyA: config.shortcode,
      PartyB: phone,
      Remarks: input.remarks.slice(0, 100),
      QueueTimeOutURL: `${config.callbackBase}/api/public/mpesa/b2c-result`,
      ResultURL: `${config.callbackBase}/api/public/mpesa/b2c-result`,
      Occassion: input.occasion.slice(0, 100),
    }),
  });
  const raw = (await res.json()) as Record<string, unknown>;
  const ok = res.ok && String(raw["ResponseCode"] ?? "") === "0";
  return {
    ok,
    conversationId: raw["ConversationID"] as string | undefined,
    originatorConversationId:
      (raw["OriginatorConversationID"] as string | undefined) ?? originatorConversationId,
    message:
      (raw["ResponseDescription"] as string) ??
      (raw["errorMessage"] as string) ??
      "M-Pesa payout failed.",
    raw,
  };
}
