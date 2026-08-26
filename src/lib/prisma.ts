import { PrismaClient } from "../generated/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var prisma: any;
  var prismaRawClient: PrismaClient | undefined;
}

const isProd = process.env["NODE_ENV"] === "production";
const databaseUrl = process.env["DATABASE_URL"] || "";

if (!databaseUrl) {
  console.error("[Database Fatal Error] DATABASE_URL environment variable is missing.");
}

const isRemoteHost =
  databaseUrl.includes("sslmode=require") ||
  databaseUrl.includes("render.com") ||
  databaseUrl.includes("supabase.co") ||
  databaseUrl.includes("neon.tech") ||
  databaseUrl.includes("amazonaws.com");

const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 10000,
  ssl: isRemoteHost ? { rejectUnauthorized: false } : undefined,
});

const adapter = new PrismaPg(pool);
const rawPrismaClient = globalThis.prismaRawClient || new PrismaClient({ adapter });

if (!isProd) {
  globalThis.prismaRawClient = rawPrismaClient;
}

const MAX_RETRIES = 3;

/**
 * Retries a database operation up to 3 times on connection/query failure.
 * If all 3 attempts fail, it throws the fatal error without any fallback database.
 */
async function executeWithRetry<T>(operation: () => Promise<T>, opName = "operation"): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      console.warn(
        `[Database] Connection/query attempt ${attempt}/${MAX_RETRIES} failed for ${opName}: ${err?.message || err}`,
      );
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 600));
      }
    }
  }
  console.error(
    `[Database Fatal Error] Database connection failed permanently after ${MAX_RETRIES} attempts for ${opName}. Crashing query.`,
  );
  throw lastError;
}

/**
 * Proxy that wraps every Prisma client model and root method with 3-attempt retry logic.
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
