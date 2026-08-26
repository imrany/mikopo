import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { getUploadedFileResponse } from "./lib/storage.server";
import { initBackgroundScheduler } from "./lib/scheduler.server";

// Start periodic background 24h overdue reminder & loan maintenance scheduler
initBackgroundScheduler();

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

const isProd = process.env.NODE_ENV === "production";

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const start = Date.now();
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // 1. High-performance instant health check for Docker, Nginx, and VPS load balancers
    if (pathname === "/healthz" || pathname === "/health" || pathname === "/api/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          env: isProd ? "production" : "development",
          uptime: Math.floor(process.uptime()),
          timestamp: Date.now(),
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store, no-cache, must-revalidate",
          },
        },
      );
    }

    try {
      // 2. Direct fast handling for uploaded asset files with ETag and 304 support
      if (
        method === "GET" &&
        (pathname.startsWith("/api/uploads/") || pathname.startsWith("/uploads/"))
      ) {
        const filename = pathname.split("/").pop() || "";
        const fileResponse = await getUploadedFileResponse(filename, request.headers);
        if (fileResponse.status === 200 || fileResponse.status === 304) {
          return fileResponse;
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      const duration = Date.now() - start;

      // 3. Optimized logging: In production, only log APIs, payment callbacks, errors, or slow requests
      if (
        !isProd ||
        pathname.startsWith("/api/") ||
        pathname.includes("callback") ||
        pathname.includes("result") ||
        duration > 800 ||
        normalized.status >= 400
      ) {
        if (
          pathname.startsWith("/api/") ||
          pathname.includes("callback") ||
          pathname.includes("result")
        ) {
          console.log(`[API Route] ${method} ${pathname} -> ${normalized.status} (${duration}ms)`);
        } else if (duration > 800) {
          console.warn(
            `[Slow Request] ${method} ${pathname} -> ${normalized.status} (${duration}ms)`,
          );
        }
      }

      return normalized;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`[API/Route Error] ${method} ${pathname} -> 500 (${duration}ms):`, error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
