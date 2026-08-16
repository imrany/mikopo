import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

const JWT_SECRET = process.env["JWT_SECRET"] || "mikopo-secure-jwt-secret-key-2026-kenya";

export interface SessionClaims {
  sub: string;
  email: string;
  roles?: string[];
  type?: string;
}

function base64UrlEncode(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function getHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signJwtToken(claims: SessionClaims): Promise<string> {
  const enc = new TextEncoder();
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    ...claims,
    iat: now,
    exp: now + 30 * 24 * 60 * 60, // 30 days
  };

  const encodedHeader = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const key = await getHmacKey();
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(dataToSign));
  const encodedSig = base64UrlEncode(new Uint8Array(sigBuffer));

  return `${dataToSign}.${encodedSig}`;
}

export async function verifyJwtToken(token: string): Promise<SessionClaims | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const key = await getHmacKey();

    let base64 = encodedSignature.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const binary = atob(base64);
    const sigBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      sigBytes[i] = binary.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(dataToSign),
    );

    if (!isValid) return null;

    const payloadJson = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(payloadJson);

    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles || [],
      type: payload.type,
    };
  } catch {
    return null;
  }
}

export const requireCustomAuth = createMiddleware({ type: "function" }).server(
  async ({ next, data }) => {
    const request = getRequest();

    let token: string | null = null;

    // 1. Try Authorization header
    const authHeader = request?.headers?.get("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }

    // 2. Try Cookie header
    if (!token && request?.headers?.get("cookie")) {
      const cookies = request.headers.get("cookie") || "";
      const match = cookies.match(/mikopo_auth_token=([^;]+)/);
      if (match) {
        token = match[1].trim();
      }
    }

    // 3. Try payload data object
    if (!token && data && typeof data === "object") {
      const d = data as Record<string, unknown>;
      if (d.authToken) token = String(d.authToken);
      else if (d.token) token = String(d.token);
      else if (
        d.headers &&
        typeof d.headers === "object" &&
        (d.headers as Record<string, unknown>).authorization
      ) {
        const h = String((d.headers as Record<string, unknown>).authorization);
        if (h.toLowerCase().startsWith("bearer ")) {
          token = h.substring(7).trim();
        }
      }
    }

    if (!token) {
      throw new Error("Unauthorized: Missing or invalid authentication token");
    }

    const claims = await verifyJwtToken(token);
    if (!claims || !claims.sub) {
      throw new Error("Unauthorized: Invalid or expired token");
    }

    return next({
      context: {
        userId: claims.sub,
        email: claims.email,
        roles: claims.roles,
      },
    });
  },
);
