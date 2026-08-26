import { PrismaClient } from "../generated/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var prisma: any;
  var prismaRealAvailable: boolean | undefined;
}

const isProd = process.env["NODE_ENV"] === "production";
const databaseUrl = process.env["DATABASE_URL"];

interface MemStoreData {
  businessSettings: any[];
  profile: any[];
  userRole: any[];
  loan: any[];
  guarantor: any[];
  payment: any[];
  auditLog: any[];
  userSession: any[];
  phoneChangeRequest: any[];
  [key: string]: any[];
}

function loadMemStore(): MemStoreData {
  return {
    businessSettings: [
      {
        id: "default-settings",
        businessName: process.env["BUSINESS_NAME"] || "Lending Platform",
        businessLocation: "Nairobi, Kenya",
        supportPhone: "+254700000000",
        supportEmail: process.env["SUPPORT_EMAIL"] || "",
        logoUrl: null,
        termsContent: null,
        privacyContent: null,
        maxLoanAmount: 50000,
        minLoanAmount: 1000,
        interestRatePercent: 12,
        repaymentPeriodDays: 30,
        setupCompleted: true,
        allowActivationWithoutDisbursement: false,
        disableSandboxMode: false,
        disableSandboxTier: false,
        enable2faByEmail: false,
        lockDarajaConfig: false,
        lockSmtpConfig: false,
        maxActiveLoansPerBorrower: 1,
        requireGuarantorsForLoans: true,
        autoRejectIfDefaulted: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    profile: [],
    userRole: [],
    loan: [],
    guarantor: [],
    payment: [],
    auditLog: [],
    userSession: [],
    phoneChangeRequest: [],
    supportTicket: [],
    supportResponse: [],
    heroImagePreset: [
      {
        id: "preset-default",
        name: "Original 3D Microfinance Concept",
        category: "3D Illustration",
        url: "",
        description: "Default sleek 3D banking and mobile phone visualization with emerald tones",
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "preset-fintech-mobile",
        name: "Modern Mobile Finance & Payments",
        category: "Mobile Banking",
        url: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1600&q=80",
        description:
          "High-tech smartphone dashboard with digital transaction visuals and clean aesthetics",
        sortOrder: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "preset-kenyan-commerce",
        name: "Kenyan Merchant & SME Enterprise",
        category: "Business & Trade",
        url: "https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=1600&q=80",
        description:
          "Professional dynamic collaborative team evaluating financial analytics and growth",
        sortOrder: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "preset-digital-wallet",
        name: "Digital Wallet & Instant Payouts",
        category: "Payments",
        url: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1600&q=80",
        description:
          "Modern financial tech display with growth charts, transaction cards, and smart metrics",
        sortOrder: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "preset-community-growth",
        name: "Community Capital & Entrepreneurship",
        category: "Empowerment",
        url: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1600&q=80",
        description:
          "Vibrant entrepreneur receiving digital capital to expand local business ventures",
        sortOrder: 4,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "preset-cyber-security",
        name: "Secure Encrypted Transactions",
        category: "Security",
        url: "https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=1600&q=80",
        description:
          "Fintech interface showing bank-grade encryption, digital safeguards, and compliance",
        sortOrder: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "preset-mobile-pos",
        name: "Tap & Pay Mobile POS Terminal",
        category: "Point of Sale",
        url: "https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=1600&q=80",
        description: "Direct contactless payment and instant cash receipt confirmation",
        sortOrder: 6,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "preset-nairobi-tech",
        name: "Nairobi Silicon Savannah Skyline",
        category: "Regional Hub",
        url: "https://images.unsplash.com/photo-1611348586804-61bf6c080437?auto=format&fit=crop&w=1600&q=80",
        description: "Dynamic African financial hub skyline illuminated at twilight",
        sortOrder: 7,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };
}

const memStore = loadMemStore();

function saveMemStore() {
  // Pure in-memory fallback store - no disk persistence needed
}

function matchesWhere(item: any, where: any): boolean {
  if (!where || typeof where !== "object") return true;

  for (const [key, val] of Object.entries(where)) {
    if (key === "OR" && Array.isArray(val)) {
      const orMatch = val.some((subWhere) => matchesWhere(item, subWhere));
      if (!orMatch) return false;
      continue;
    }
    if (key === "AND" && Array.isArray(val)) {
      const andMatch = val.every((subWhere) => matchesWhere(item, subWhere));
      if (!andMatch) return false;
      continue;
    }

    const itemVal = item[key];
    if (val && typeof val === "object" && !(val instanceof Date)) {
      if ("equals" in val) {
        const mode = val.mode;
        if (
          mode === "insensitive" &&
          typeof itemVal === "string" &&
          typeof val.equals === "string"
        ) {
          if (itemVal.toLowerCase() !== val.equals.toLowerCase()) return false;
        } else if (itemVal !== val.equals) {
          return false;
        }
      } else if ("in" in val && Array.isArray(val.in)) {
        if (!val.in.includes(itemVal)) return false;
      } else if ("notIn" in val && Array.isArray(val.notIn)) {
        if (val.notIn.includes(itemVal)) return false;
      } else if ("contains" in val) {
        if (
          typeof itemVal !== "string" ||
          !itemVal.toLowerCase().includes(String(val.contains).toLowerCase())
        ) {
          return false;
        }
      } else {
        const parseVal = (v: any) => {
          if (v instanceof Date) return v.getTime();
          if (
            typeof v === "string" &&
            v.length >= 10 &&
            !isNaN(Date.parse(v)) &&
            (v.includes("-") || v.includes(":"))
          ) {
            return new Date(v).getTime();
          }
          return v;
        };

        if ("gt" in val) {
          if (parseVal(itemVal) <= parseVal(val.gt)) return false;
        } else if ("gte" in val) {
          if (parseVal(itemVal) < parseVal(val.gte)) return false;
        } else if ("lt" in val) {
          if (parseVal(itemVal) >= parseVal(val.lt)) return false;
        } else if ("lte" in val) {
          if (parseVal(itemVal) > parseVal(val.lte)) return false;
        }
      }
    } else {
      if (itemVal !== val) return false;
    }
  }

  return true;
}

function populateIncludes(model: string, item: any, include?: any) {
  if (!item || !include || typeof include !== "object") return item;
  const clone = { ...item };

  if (model === "loan") {
    if (include.user) {
      const u = memStore.profile?.find((p) => p.id === clone.userId);
      clone.user = u ? { ...u } : null;
    }
    if (include.product) {
      const p = memStore.loanProduct?.find((lp) => lp.id === clone.productId);
      clone.product = p ? { ...p } : null;
    }
    if (include.guarantors) {
      clone.guarantors = (memStore.loanGuarantor || []).filter((g) => g.loanId === clone.id);
    }
    if (include.mpesaTransactions) {
      clone.mpesaTransactions = (memStore.mpesaTransaction || []).filter(
        (t) => t.loanId === clone.id,
      );
    }
    if (include.repayments) {
      clone.repayments = (memStore.loanRepayment || []).filter((r) => r.loanId === clone.id);
    }
    if (include.statusEvents) {
      clone.statusEvents = (memStore.loanStatusEvent || []).filter((s) => s.loanId === clone.id);
    }
  }

  if (model === "profile") {
    if (include.roles) {
      clone.roles = (memStore.userRole || []).filter((r) => r.userId === clone.id);
    }
    if (include.loans) {
      clone.loans = (memStore.loan || []).filter((l) => l.userId === clone.id);
    }
  }

  if (model === "loanGuarantor") {
    if (include.loan) {
      const l = memStore.loan?.find((lo) => lo.id === clone.loanId);
      clone.loan = l ? { ...l } : null;
    }
    if (include.guarantor) {
      const g = memStore.profile?.find((p) => p.id === clone.guarantorId);
      clone.guarantor = g ? { ...g } : null;
    }
  }

  return clone;
}

function handleMemMethod(model: string, method: string, args: any = {}) {
  if (!memStore[model]) {
    memStore[model] = [];
  }
  const collection = memStore[model];

  switch (method) {
    case "findFirst": {
      const item = collection.find((i) => matchesWhere(i, args?.where));
      return item ? populateIncludes(model, item, args?.include) : null;
    }
    case "findUnique": {
      const item = collection.find((i) => matchesWhere(i, args?.where));
      return item ? populateIncludes(model, item, args?.include) : null;
    }
    case "findMany": {
      let results = collection.filter((i) => matchesWhere(i, args?.where));
      if (args?.take && typeof args.take === "number") {
        results = results.slice(0, args.take);
      }
      return results.map((i) => populateIncludes(model, i, args?.include));
    }
    case "count": {
      const count = collection.filter((i) => matchesWhere(i, args?.where)).length;
      return count;
    }
    case "create": {
      const newItem = {
        id: args?.data?.id || crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...args?.data,
      };
      collection.push(newItem);
      saveMemStore();
      return { ...newItem };
    }
    case "update": {
      const idx = collection.findIndex((i) => matchesWhere(i, args?.where));
      if (idx !== -1) {
        collection[idx] = {
          ...collection[idx],
          ...args?.data,
          updatedAt: new Date().toISOString(),
        };
        saveMemStore();
        return { ...collection[idx] };
      }
      return null;
    }
    case "updateMany": {
      let count = 0;
      for (let idx = 0; idx < collection.length; idx++) {
        if (matchesWhere(collection[idx], args?.where)) {
          collection[idx] = {
            ...collection[idx],
            ...args?.data,
            updatedAt: new Date().toISOString(),
          };
          count++;
        }
      }
      if (count > 0) saveMemStore();
      return { count };
    }
    case "upsert": {
      const existing = collection.find((i) => matchesWhere(i, args?.where));
      if (existing) {
        Object.assign(existing, args?.update, { updatedAt: new Date().toISOString() });
        saveMemStore();
        return { ...existing };
      } else {
        const newItem = {
          id: args?.create?.id || crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...args?.create,
        };
        collection.push(newItem);
        saveMemStore();
        return { ...newItem };
      }
    }
    case "delete": {
      const idx = collection.findIndex((i) => matchesWhere(i, args?.where));
      if (idx !== -1) {
        const removed = collection.splice(idx, 1)[0];
        saveMemStore();
        return { ...removed };
      }
      return {};
    }
    case "deleteMany": {
      const initialLen = collection.length;
      memStore[model] = collection.filter((i) => !matchesWhere(i, args?.where));
      const count = initialLen - memStore[model].length;
      if (count > 0) saveMemStore();
      return { count };
    }
    case "aggregate": {
      return { _sum: {}, _count: { _all: collection.length }, _avg: {}, _min: {}, _max: {} };
    }
    case "groupBy": {
      return [];
    }
    default:
      return null;
  }
}

// Create Real Prisma instance if DATABASE_URL is set
let realPrismaClient: any = null;
if (databaseUrl && globalThis.prismaRealAvailable !== false) {
  try {
    const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 2000 });
    const adapter = new PrismaPg(pool);
    realPrismaClient = globalThis.prisma || new PrismaClient({ adapter });
  } catch (err) {
    console.warn("[AI Studio] Error initializing real PrismaClient:", err);
  }
}

let useFallbackStore = globalThis.prismaRealAvailable === false || !realPrismaClient;

function isNetworkOrConnectionError(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message || err);
  const code = String(err?.code || "");
  return (
    msg.includes("getaddrinfo EAI_AGAIN") ||
    msg.includes("EAI_AGAIN") ||
    msg.includes("P1001") ||
    msg.includes("P1002") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("Connection terminated") ||
    msg.includes("connection timeout") ||
    msg.includes("Can't reach database server") ||
    code === "P1001" ||
    code === "P1002" ||
    code === "EAI_AGAIN" ||
    code === "ETIMEDOUT" ||
    code === "57P01"
  );
}

function createSmartPrismaProxy(): any {
  return new Proxy(function () {}, {
    get: (_target, prop) => {
      if (prop === "$transaction") {
        return async (fn: any) => {
          if (typeof fn === "function") {
            return fn(createSmartPrismaProxy());
          }
          if (Array.isArray(fn)) {
            return Promise.all(fn);
          }
          return [];
        };
      }

      if (typeof prop === "string" && prop.startsWith("$")) {
        return async () => {
          if (
            !useFallbackStore &&
            realPrismaClient &&
            typeof realPrismaClient[prop] === "function"
          ) {
            try {
              return await realPrismaClient[prop]();
            } catch (err) {
              if (isNetworkOrConnectionError(err)) {
                useFallbackStore = true;
                globalThis.prismaRealAvailable = false;
              }
            }
          }
          return [];
        };
      }

      const model = prop as string;

      return new Proxy(
        {},
        {
          get: (_modelTarget, methodProp) => {
            const method = methodProp as string;

            return async (...args: any[]) => {
              if (!useFallbackStore && realPrismaClient && realPrismaClient[model]?.[method]) {
                try {
                  return await realPrismaClient[model][method](...args);
                } catch (err) {
                  if (isNetworkOrConnectionError(err)) {
                    console.warn(
                      `[AI Studio] Database connection issue detected (${model}.${method}). Switching to fallback store.`,
                    );
                    useFallbackStore = true;
                    globalThis.prismaRealAvailable = false;
                    return handleMemMethod(model, method, args[0]);
                  }
                  throw err;
                }
              }

              return handleMemMethod(model, method, args[0]);
            };
          },
        },
      );
    },
    apply: () => {
      return createSmartPrismaProxy();
    },
  });
}

const prismaInstance = createSmartPrismaProxy();

export const prisma = prismaInstance;

if (!isProd) {
  globalThis.prisma = prismaInstance;
}
