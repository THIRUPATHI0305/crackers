import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export const CSRF_COOKIE = "sn_csrf";
export const CSRF_HEADER = "x-csrf-token";

function secret() {
  return (
    process.env.CSRF_SECRET ||
    process.env.SESSION_SECRET ||
    "dev-csrf-secret-change-me-32chars!!"
  );
}

export function createCsrfToken() {
  const nonce = randomBytes(24).toString("hex");
  const sig = createHmac("sha256", secret()).update(nonce).digest("hex");
  return `${nonce}.${sig}`;
}

export function verifyCsrfToken(token: string | null | undefined) {
  if (!token || !token.includes(".")) return false;
  const [nonce, sig] = token.split(".");
  if (!nonce || !sig) return false;
  const expected = createHmac("sha256", secret()).update(nonce).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function parseCookie(header: string | null, name: string) {
  if (!header) return null;
  const parts = header.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function readCsrfFromRequest(req: Request) {
  const header = req.headers.get(CSRF_HEADER);
  const cookie = parseCookie(req.headers.get("cookie"), CSRF_COOKIE);
  return { header, cookie };
}

/** Double-submit cookie: header must match cookie and both must verify. */
export function assertCsrf(req: Request): { ok: true } | { ok: false; reason: string } {
  const { header, cookie } = readCsrfFromRequest(req);
  if (!header || !cookie) return { ok: false, reason: "Missing CSRF token" };
  if (header !== cookie) return { ok: false, reason: "CSRF token mismatch" };
  if (!verifyCsrfToken(header)) return { ok: false, reason: "Invalid CSRF token" };

  const origin = req.headers.get("origin");
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (origin && app) {
    try {
      if (new URL(origin).origin !== new URL(app).origin) {
        return { ok: false, reason: "Invalid origin" };
      }
    } catch {
      return { ok: false, reason: "Invalid origin" };
    }
  }
  return { ok: true };
}

export function csrfCookieHeader(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${CSRF_COOKIE}=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=86400${secure}`;
}

export function issueCsrfResponse() {
  const token = createCsrfToken();
  const res = NextResponse.json({ csrfToken: token });
  res.headers.set("Set-Cookie", csrfCookieHeader(token));
  return res;
}
