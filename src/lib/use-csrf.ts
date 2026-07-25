"use client";

import { useCallback, useEffect, useState } from "react";

export const CSRF_HEADER = "x-csrf-token";

let cachedToken: string | null = null;
let inflight: Promise<string> | null = null;

async function fetchCsrfToken() {
  if (cachedToken) return cachedToken;
  if (!inflight) {
    inflight = fetch("/api/csrf")
      .then((r) => r.json())
      .then((d) => {
        cachedToken = d.csrfToken as string;
        return cachedToken;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useCsrf() {
  const [token, setToken] = useState<string | null>(cachedToken);
  const [ready, setReady] = useState(Boolean(cachedToken));

  useEffect(() => {
    let alive = true;
    fetchCsrfToken()
      .then((t) => {
        if (alive) {
          setToken(t);
          setReady(true);
        }
      })
      .catch(() => {
        if (alive) setReady(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const withCsrf = useCallback(async (init: RequestInit = {}) => {
    const t = await fetchCsrfToken();
    const headers = new Headers(init.headers || {});
    headers.set(CSRF_HEADER, t);
    headers.set(
      "Content-Type",
      headers.get("Content-Type") || "application/json"
    );
    return { ...init, headers, credentials: "same-origin" as const };
  }, []);

  return { token, ready, withCsrf };
}

export function fieldErrorsFromZod(error: {
  fields?: Record<string, string[]>;
  message?: string;
}) {
  const out: Record<string, string> = {};
  if (error?.fields) {
    for (const [k, v] of Object.entries(error.fields)) {
      if (v?.[0]) out[k] = v[0];
    }
  }
  return out;
}
