import { PrismaClient } from "../generated/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var prisma: any;
  var prismaRawClient: PrismaClient | undefined;
  var pgPoolInstance: Pool | undefined;
}

const isProd = process.env["NODE_ENV"] === "production";
const databaseUrl = process.env["DATABASE_URL"] || "";

let rawPrismaClient: any;
let pool: Pool | undefined;

try {
  if (databaseUrl) {
    const isRemoteHost =
      databaseUrl.includes("sslmode=require") ||
      databaseUrl.includes("render.com") ||
      databaseUrl.includes("supabase.co") ||
      databaseUrl.includes("neon.tech") ||
      databaseUrl.includes("amazonaws.com");

    const poolMax = parseInt(process.env["DB_POOL_MAX"] || (isProd ? "25" : "10"), 10);
    const poolMin = parseInt(process.env["DB_POOL_MIN"] || (isProd ? "2" : "1"), 10);

    pool =
      globalThis.pgPoolInstance ||
      new Pool({
        connectionString: databaseUrl,
        max: Math.max(5, isNaN(poolMax) ? 25 : poolMax),
        min: Math.max(1, isNaN(poolMin) ? 2 : poolMin),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        maxUses: 10000,
        keepAlive: true,
        ssl: isRemoteHost ? { rejectUnauthorized: false } : undefined,
      });

    if (!isProd) {
      globalThis.pgPoolInstance = pool;
    }

    const adapter = new PrismaPg(pool);
    rawPrismaClient = globalThis.prismaRawClient || new PrismaClient({ adapter });
  } else {
    console.warn("[AI Studio] DATABASE_URL not set — activating mock data proxy");
    const noOp: any = {
      findMany: async () => [],
      findFirst: async () => null,
      findUnique: async () => null,
      count: async () => 0,
      create: async (d: any) => d?.data ?? {},
      update: async (d: any) => d?.data ?? {},
      delete: async () => ({}),
      upsert: async (d: any) => d?.create ?? {},
    };
    rawPrismaClient = new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === "$transaction") {
            return async (fnOrArr: any) =>
              typeof fnOrArr === "function" ? fnOrArr(rawPrismaClient) : [];
          }
          return noOp;
        },
      },
    );
  }
} catch {
  console.warn("[AI Studio] Database not connected — using mock");
  const noOp: any = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    count: async () => 0,
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {},
    delete: async () => ({}),
    upsert: async (d: any) => d?.create ?? {},
  };
  rawPrismaClient = new Proxy(
    {},
    {
      get: (_, prop) => {
        if (prop === "$transaction") {
          return async (fnOrArr: any) =>
            typeof fnOrArr === "function" ? fnOrArr(rawPrismaClient) : [];
        }
        return noOp;
      },
    },
  );
}

if (!isProd) {
  globalThis.prismaRawClient = rawPrismaClient;
}

const MAX_RETRIES = 3;

/**
 * Checks whether an error is a transient connection failure that is safe to retry.
 * Non-transient errors (validation, unique key constraint, missing records) are NOT retried.
 */
function isTransientDbError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  const code = (err.code || "").toString();

  // PostgreSQL transient error codes & Prisma connection failure codes
  const transientCodes = [
    "P1001",
    "P1002",
    "P1008",
    "P1017",
    "57P01",
    "57P02",
    "57P03",
    "08000",
    "08003",
    "08006",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ECONNRESET",
  ];
  if (transientCodes.includes(code)) return true;

  if (
    msg.includes("connection terminated") ||
    msg.includes("connection lost") ||
    msg.includes("connection closed") ||
    msg.includes("timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("client has encountered a connection error") ||
    msg.includes("server closed the connection") ||
    msg.includes("sorry, too many clients already")
  ) {
    return true;
  }

  return false;
}

/**
 * Retries transient network/connection failures with exponential backoff.
 * Immediately throws permanent application errors without waiting.
 */
async function executeWithRetry<T>(operation: () => Promise<T>, opName = "operation"): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      if (!isTransientDbError(err)) {
        // Not a transient connection error - throw immediately to avoid blocking client requests
        throw err;
      }
      console.warn(
        `[Database] Transient connection attempt ${attempt}/${MAX_RETRIES} failed for ${opName}: ${err?.message || err}`,
      );
      if (attempt < MAX_RETRIES) {
        const backoff = attempt * 250 + Math.floor(Math.random() * 100);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }
  console.error(
    `[Database Fatal Error] Transient database connection failed after ${MAX_RETRIES} attempts for ${opName}.`,
  );
  throw lastError;
}

/**
 * Proxy that wraps Prisma client methods with selective transient retry logic.
 */
function createPrismaProxy(targetClient: any): any {
  return new Proxy(targetClient, {
    get(target, prop) {
      if (prop === "$transaction") {
        return async (...args: any[]) => {
          return executeWithRetry(async () => {
            if (typeof args[0] === "function") {
              return target.$transaction(async (tx: any) => {
                return args[0](createPrismaProxy(tx));
              }, args[1]);
            }
            return target.$transaction(...args);
          }, "$transaction");
        };
      }

      const orig = target[prop];

      if (typeof orig === "function") {
        return (...args: any[]) => executeWithRetry(() => orig.apply(target, args), String(prop));
      }

      if (typeof orig === "object" && orig !== null) {
        return new Proxy(orig, {
          get(modelTarget, methodProp) {
            const method = modelTarget[methodProp];
            if (typeof method === "function") {
              return (...args: any[]) =>
                executeWithRetry(
                  () => method.apply(modelTarget, args),
                  `${String(prop)}.${String(methodProp)}`,
                );
            }
            return method;
          },
        });
      }

      return orig;
    },
  });
}

const prismaInstance = createPrismaProxy(rawPrismaClient);

export const prisma = prismaInstance;

if (!isProd) {
  globalThis.prisma = prismaInstance;
}
