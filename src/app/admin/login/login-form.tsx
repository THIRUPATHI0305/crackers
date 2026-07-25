"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function AdminLoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-atmosphere px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-sm font-bold text-white">
            SN
          </div>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
            Admin login
          </h1>
          <p className="mt-2 text-sm text-muted">
            Secure access for Admin and Cashier roles
          </p>
        </div>

        <form
          className="mt-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
              const res = await fetch("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  user: form.get("user"),
                  password: form.get("password"),
                }),
              });
              const data = await res.json();
              if (!res.ok) {
                setError(data?.error?.message || "Login failed");
                setLoading(false);
                return;
              }
              router.push(search.get("next") || "/admin/dashboard");
              router.refresh();
            } catch {
              setError("Network error. Try again.");
              setLoading(false);
            }
          }}
        >
          <label className="block text-sm font-semibold text-navy">
            Email or username
            <input
              name="user"
              type="text"
              autoComplete="username"
              defaultValue="admin@sparknova.in"
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber focus:bg-surface"
            />
          </label>

          <label className="block text-sm font-semibold text-navy">
            Password
            <div className="relative mt-1.5">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                defaultValue="Admin@12345"
                className="w-full rounded-xl border border-border bg-surface-muted px-4 py-3 pr-20 text-sm outline-none focus:border-amber focus:bg-surface"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {error && (
            <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-navy py-3.5 text-sm font-bold text-white transition hover:bg-navy-soft disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Login"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Admin: admin@sparknova.in / Admin@12345
          <br />
          Cashier: cashier@sparknova.in / Cashier@12345
          <br />
          <Link href="/" className="font-semibold text-navy underline">
            Back to store
          </Link>
        </p>
      </div>
    </div>
  );
}
