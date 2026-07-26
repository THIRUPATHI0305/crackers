"use client";

import { useEffect, useState } from "react";
import { PHONE_UPI_PROVIDERS, phoneBasedUpiId } from "@/lib/upi";

type Shop = {
  name: string;
  tagline: string;
  headerBanner: string;
  address: string;
  phone: string;
  whatsapp: string;
  upiId: string;
  email: string;
  hours: string;
  mapsUrl: string;
  languages: { en: boolean; ta: boolean; hi: boolean };
};

type Loyalty = {
  pointsPerHundred: number;
  minRedemptionPoints: number;
  maxDiscountPercent: number;
  maxLoyaltyDiscountAmount: number;
  expiryMonths: number;
  enabled: boolean;
};

type OtpSettings = {
  provider: "email" | "authkey" | "fast2sms" | "none";
  emailConfigured: boolean;
  emailFromHint: string;
  smtpConfigured: boolean;
  smtpHostHint: string;
  smtpPassHint: string;
  resendConfigured: boolean;
  resendApiKeyHint: string;
  authkeyConfigured: boolean;
  authkeyAuthKeyHint: string;
  authkeySidHint: string;
  fast2smsConfigured: boolean;
  fast2smsApiKeyHint: string;
  envConfigured: boolean;
};

export default function AdminSettingsPage() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [otp, setOtp] = useState<OtpSettings | null>(null);
  const [emailFrom, setEmailFrom] = useState("");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [clearSmtpPass, setClearSmtpPass] = useState(false);
  const [resendApiKey, setResendApiKey] = useState("");
  const [clearResend, setClearResend] = useState(false);
  const [authkeyAuthKey, setAuthkeyAuthKey] = useState("");
  const [authkeySid, setAuthkeySid] = useState("");
  const [fast2smsApiKey, setFast2smsApiKey] = useState("");
  const [clearAuthkey, setClearAuthkey] = useState(false);
  const [clearKey, setClearKey] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [upiPhone, setUpiPhone] = useState("");
  const [upiProvider, setUpiProvider] = useState<string>(
    PHONE_UPI_PROVIDERS[0].suffix
  );

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.shop) {
          setShop({
            headerBanner: "",
            ...data.shop,
          });
          const digits = String(data.shop.phone || "").replace(/\D/g, "");
          const ten =
            digits.length === 12 && digits.startsWith("91")
              ? digits.slice(2)
              : digits.slice(-10);
          if (/^[6-9]\d{9}$/.test(ten)) setUpiPhone(ten);
        }
        if (data.loyalty) setLoyalty(data.loyalty);
        if (data.otp) {
          setOtp(data.otp);
          if (data.otp.emailFromHint) setEmailFrom(data.otp.emailFromHint);
          else if (data.shop?.email) setEmailFrom(data.shop.email);
          if (data.otp.smtpHostHint) setSmtpHost(data.otp.smtpHostHint);
        }
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!shop || !loyalty) return;
    setLoading(true);
    setError("");
    setMsg("");
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop,
        loyalty,
        otp: {
          emailFrom: emailFrom.trim() || shop.email || undefined,
          smtpHost: smtpHost.trim() || "smtp.gmail.com",
          smtpPort,
          smtpUser: smtpUser.trim() || undefined,
          smtpPass: clearSmtpPass
            ? undefined
            : smtpPass.replace(/\s+/g, "") || undefined,
          clearSmtpPass: clearSmtpPass || undefined,
          resendApiKey: clearResend ? undefined : resendApiKey || undefined,
          clearResendApiKey: clearResend || undefined,
          authkeyAuthKey: clearAuthkey ? undefined : authkeyAuthKey || undefined,
          authkeySid: clearAuthkey ? undefined : authkeySid || undefined,
          clearAuthkey: clearAuthkey || undefined,
          fast2smsApiKey: clearKey ? undefined : fast2smsApiKey || undefined,
          clearFast2smsApiKey: clearKey || undefined,
        },
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data?.error?.message || "Save failed");
      return;
    }
    setShop(data.shop);
    setLoyalty(data.loyalty);
    if (data.otp) {
      setOtp(data.otp);
      if (data.otp.emailFromHint) setEmailFrom(data.otp.emailFromHint);
    }
    setSmtpPass("");
    setResendApiKey("");
    setAuthkeyAuthKey("");
    setAuthkeySid("");
    setFast2smsApiKey("");
    setClearSmtpPass(false);
    setClearResend(false);
    setClearAuthkey(false);
    setClearKey(false);
    setMsg("Settings saved");
  }

  if (!shop || !loyalty) {
    return <p className="text-sm text-muted">Loading settings…</p>;
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Shop profile, loyalty rules, languages — saved to database
        </p>
      </div>

      <div className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="font-bold text-navy">Shop profile</h2>
        <label className="block text-sm font-semibold text-navy">
          Shop name
          <input
            required
            value={shop.name}
            onChange={(e) => setShop({ ...shop, name: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
          />
        </label>
        <label className="block text-sm font-semibold text-navy">
          Tagline
          <input
            value={shop.tagline}
            onChange={(e) => setShop({ ...shop, tagline: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            placeholder="Shown under the shop name on the storefront"
          />
        </label>
        <label className="block text-sm font-semibold text-navy">
          Header banner text
          <input
            value={shop.headerBanner}
            onChange={(e) =>
              setShop({ ...shop, headerBanner: e.target.value })
            }
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            placeholder="Top bar text when no live offer — e.g. Free packing on ₹3,000+"
          />
          <span className="mt-1 block text-xs font-normal text-muted">
            Live Admin → Offers take priority in the storefront header bar.
          </span>
        </label>
        <label className="block text-sm font-semibold text-navy">
          Address
          <textarea
            required
            rows={2}
            value={shop.address}
            onChange={(e) => setShop({ ...shop, address: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-navy">
            Phone
            <input
              required
              value={shop.phone}
              onChange={(e) => setShop({ ...shop, phone: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            />
          </label>
          <label className="text-sm font-semibold text-navy">
            WhatsApp number
            <input
              required
              value={shop.whatsapp}
              onChange={(e) => setShop({ ...shop, whatsapp: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
              placeholder="Digits only, with country code"
            />
          </label>
          <div className="sm:col-span-2 space-y-3 rounded-xl border border-border bg-surface-muted/50 p-4">
            <p className="text-sm font-semibold text-navy">
              Shop receive UPI (hidden from customers)
            </p>
            <p className="text-xs text-muted">
              Customers only see “Pay with GPay / PhonePe / Paytm” — your UPI ID
              is never shown on the pay page. Money still goes to this ID.
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <label className="text-xs font-semibold text-navy">
                Mobile number
                <input
                  value={upiPhone}
                  onChange={(e) =>
                    setUpiPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-amber"
                  placeholder="10-digit mobile linked to UPI"
                  inputMode="numeric"
                />
              </label>
              <label className="text-xs font-semibold text-navy">
                App
                <select
                  value={upiProvider}
                  onChange={(e) => setUpiProvider(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-amber"
                >
                  {PHONE_UPI_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.suffix}>
                      {p.label} (@{p.suffix})
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    const built = phoneBasedUpiId(upiPhone, upiProvider);
                    if (!built) {
                      setError(
                        "Enter a valid 10-digit mobile to build phone UPI ID"
                      );
                      return;
                    }
                    setError("");
                    setShop({ ...shop, upiId: built });
                  }}
                  className="w-full rounded-full bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-soft"
                >
                  Use phone UPI
                </button>
              </div>
            </div>
            <label className="block text-xs font-semibold text-navy">
              Or paste any UPI ID
              <input
                value={shop.upiId || ""}
                onChange={(e) => setShop({ ...shop, upiId: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 font-mono text-sm outline-none focus:border-amber"
                placeholder="9876543210@ybl or shop@oksbi"
              />
            </label>
            <button
              type="button"
              onClick={() => setShop({ ...shop, upiId: "" })}
              className="text-xs font-semibold text-amber hover:underline"
            >
              Clear UPI (disable online pay links)
            </button>
          </div>
          <label className="text-sm font-semibold text-navy">
            Email
            <input
              type="email"
              value={shop.email}
              onChange={(e) => setShop({ ...shop, email: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            />
          </label>
          <label className="text-sm font-semibold text-navy">
            Business hours
            <input
              value={shop.hours}
              onChange={(e) => setShop({ ...shop, hours: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
              placeholder="Mon–Sun · 9:00 AM – 9:00 PM"
            />
          </label>
        </div>
        <label className="block text-sm font-semibold text-navy">
          Google Maps URL
          <input
            type="url"
            value={shop.mapsUrl}
            onChange={(e) => setShop({ ...shop, mapsUrl: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            placeholder="https://maps.google.com/..."
          />
        </label>
      </div>

      <div className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="font-bold text-navy">Loyalty rules</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-navy">
            Points per ₹100
            <input
              type="number"
              min={0}
              value={loyalty.pointsPerHundred}
              onChange={(e) =>
                setLoyalty({
                  ...loyalty,
                  pointsPerHundred: Number(e.target.value),
                })
              }
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            />
          </label>
          <label className="text-sm font-semibold text-navy">
            Min redemption points
            <input
              type="number"
              min={0}
              value={loyalty.minRedemptionPoints}
              onChange={(e) =>
                setLoyalty({
                  ...loyalty,
                  minRedemptionPoints: Number(e.target.value),
                })
              }
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            />
          </label>
          <label className="text-sm font-semibold text-navy">
            Max discount %
            <input
              type="number"
              min={0}
              max={100}
              value={loyalty.maxDiscountPercent}
              onChange={(e) =>
                setLoyalty({
                  ...loyalty,
                  maxDiscountPercent: Number(e.target.value),
                })
              }
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            />
          </label>
          <label className="text-sm font-semibold text-navy">
            Max loyalty ₹
            <input
              type="number"
              min={0}
              value={loyalty.maxLoyaltyDiscountAmount}
              onChange={(e) =>
                setLoyalty({
                  ...loyalty,
                  maxLoyaltyDiscountAmount: Number(e.target.value),
                })
              }
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            />
          </label>
          <label className="text-sm font-semibold text-navy">
            Expiry (months)
            <input
              type="number"
              min={1}
              value={loyalty.expiryMonths}
              onChange={(e) =>
                setLoyalty({
                  ...loyalty,
                  expiryMonths: Number(e.target.value),
                })
              }
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-navy">
          <input
            type="checkbox"
            checked={loyalty.enabled}
            onChange={(e) =>
              setLoyalty({ ...loyalty, enabled: e.target.checked })
            }
            className="accent-amber"
          />
          Enable loyalty programme
        </label>
      </div>

      <div className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="font-bold text-navy">OTP Email (company email)</h2>
        <p className="text-sm text-muted">
          OTP emails are sent from your company Gmail. Google blocks normal
          passwords — you must use a 16-character{" "}
          <a
            href="https://myaccount.google.com/apppasswords"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-navy underline"
          >
            App Password
          </a>
          .
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Turn on 2-Step Verification for the Gmail account</li>
          <li>
            Open{" "}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-navy underline"
            >
              App passwords
            </a>{" "}
            → choose Mail → generate
          </li>
          <li>Paste the 16-character password below (spaces are OK) → Save</li>
        </ol>
        {otp?.emailConfigured ? (
          <p className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
            Email OTP ready — from {otp.emailFromHint || "company email"}
            {otp.smtpConfigured ? " via SMTP" : ""}
            {otp.resendConfigured ? " via Resend" : ""}
          </p>
        ) : (
          <p className="rounded-xl bg-amber/10 px-3 py-2 text-sm text-amber">
            Not configured — OTPs stay in Dev mode (code on screen) until you
            save company email + app password.
          </p>
        )}
        <label className="block text-sm font-semibold text-navy">
          Company email (FROM)
          <input
            type="email"
            value={emailFrom}
            onChange={(e) => setEmailFrom(e.target.value)}
            placeholder={shop.email || "shop@gmail.com"}
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
          />
          <span className="mt-1 block text-xs font-normal text-muted">
            Tip: also set the same address under Shop profile → Email. Use{" "}
            <strong>gmail.com</strong> (not gamil.com).
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-navy">
            SMTP host
            <input
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              placeholder="smtp.gmail.com"
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            />
          </label>
          <label className="text-sm font-semibold text-navy">
            SMTP port
            <input
              type="number"
              value={smtpPort}
              onChange={(e) => setSmtpPort(Number(e.target.value) || 587)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            />
          </label>
        </div>
        <label className="block text-sm font-semibold text-navy">
          SMTP username (usually same as company email)
          <input
            type="email"
            value={smtpUser}
            onChange={(e) => setSmtpUser(e.target.value)}
            placeholder={emailFrom || shop.email || "same as company email"}
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
          />
        </label>
        <label className="block text-sm font-semibold text-navy">
          Gmail App Password
          <input
            type="password"
            autoComplete="new-password"
            value={smtpPass}
            onChange={(e) => {
              setSmtpPass(e.target.value);
              setClearSmtpPass(false);
            }}
            placeholder={
              otp?.smtpConfigured
                ? "Leave blank to keep current password"
                : "16-character app password"
            }
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
          />
        </label>
        {otp?.smtpConfigured ? (
          <label className="flex items-center gap-2 text-sm font-semibold text-danger">
            <input
              type="checkbox"
              checked={clearSmtpPass}
              onChange={(e) => setClearSmtpPass(e.target.checked)}
              className="accent-danger"
            />
            Remove stored SMTP password
          </label>
        ) : null}
        <details className="rounded-xl border border-border bg-surface-muted/40 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-navy">
            Optional: Resend API (instead of Gmail SMTP)
          </summary>
          <label className="mt-3 block text-sm font-semibold text-navy">
            Resend API key
            <input
              type="password"
              autoComplete="off"
              value={resendApiKey}
              onChange={(e) => {
                setResendApiKey(e.target.value);
                setClearResend(false);
              }}
              placeholder={
                otp?.resendConfigured
                  ? "Leave blank to keep current key"
                  : "re_…"
              }
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-amber"
            />
          </label>
          {otp?.resendConfigured ? (
            <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-danger">
              <input
                type="checkbox"
                checked={clearResend}
                onChange={(e) => setClearResend(e.target.checked)}
                className="accent-danger"
              />
              Remove stored Resend key
            </label>
          ) : null}
        </details>
      </div>

      <div className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="font-bold text-navy">OTP SMS (AuthKey — fallback)</h2>
        <p className="text-sm text-muted">
          Free signup + trial SMS credit at{" "}
          <a
            href="https://authkey.io"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-navy underline"
          >
            authkey.io
          </a>
          . Create an SMS template with{" "}
          <code className="rounded bg-surface-muted px-1 text-xs">{`{#2fa#}`}</code>{" "}
          (see{" "}
          <a
            href="https://authkey.io/2fa-api-docs"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-navy underline"
          >
            2FA API docs
          </a>
          ), copy Auth Key + template SID, paste below → Save.
        </p>
        {otp?.authkeyConfigured ? (
          <p className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
            AuthKey configured (key {otp.authkeyAuthKeyHint}
            {otp.authkeySidHint ? ` · SID ${otp.authkeySidHint}` : ""}
            {otp.envConfigured ? " · also set in .env" : ""})
          </p>
        ) : (
          <p className="rounded-xl bg-amber/10 px-3 py-2 text-sm text-amber">
            AuthKey not set — email OTP is preferred; SMS is optional fallback.
          </p>
        )}
        <label className="block text-sm font-semibold text-navy">
          AuthKey auth key
          <input
            type="password"
            autoComplete="off"
            value={authkeyAuthKey}
            onChange={(e) => {
              setAuthkeyAuthKey(e.target.value);
              setClearAuthkey(false);
            }}
            placeholder={
              otp?.authkeyConfigured
                ? "Leave blank to keep current key"
                : "Paste AuthKey from dashboard"
            }
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
          />
        </label>
        <label className="block text-sm font-semibold text-navy">
          Template SID (2FA / OTP)
          <input
            type="text"
            autoComplete="off"
            value={authkeySid}
            onChange={(e) => {
              setAuthkeySid(e.target.value);
              setClearAuthkey(false);
            }}
            placeholder={
              otp?.authkeySidHint
                ? `Current: ${otp.authkeySidHint} — leave blank to keep`
                : "e.g. 1001"
            }
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
          />
        </label>
        {otp?.authkeyConfigured ? (
          <label className="flex items-center gap-2 text-sm font-semibold text-danger">
            <input
              type="checkbox"
              checked={clearAuthkey}
              onChange={(e) => setClearAuthkey(e.target.checked)}
              className="accent-danger"
            />
            Remove stored AuthKey credentials
          </label>
        ) : null}
      </div>

      <div className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="font-bold text-navy">OTP SMS fallback (Fast2SMS)</h2>
        <p className="text-sm text-muted">
          Used only if AuthKey is not configured. Free trial at{" "}
          <a
            href="https://www.fast2sms.com"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-navy underline"
          >
            fast2sms.com
          </a>
          → Dev API → Authorization key.
        </p>
        {otp?.fast2smsConfigured ? (
          <p className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
            Fast2SMS configured ({otp.fast2smsApiKeyHint})
          </p>
        ) : (
          <p className="rounded-xl bg-surface-muted px-3 py-2 text-sm text-muted">
            Optional fallback — not required when AuthKey is set.
          </p>
        )}
        <label className="block text-sm font-semibold text-navy">
          Fast2SMS API key
          <input
            type="password"
            autoComplete="off"
            value={fast2smsApiKey}
            onChange={(e) => {
              setFast2smsApiKey(e.target.value);
              setClearKey(false);
            }}
            placeholder={
              otp?.fast2smsConfigured
                ? "Leave blank to keep current key"
                : "Paste Authorization key"
            }
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
          />
        </label>
        {otp?.fast2smsConfigured ? (
          <label className="flex items-center gap-2 text-sm font-semibold text-danger">
            <input
              type="checkbox"
              checked={clearKey}
              onChange={(e) => setClearKey(e.target.checked)}
              className="accent-danger"
            />
            Remove stored Fast2SMS key
          </label>
        ) : null}
      </div>

      <div className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="font-bold text-navy">Languages</h2>
        <div className="flex flex-wrap gap-4 text-sm text-navy">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={shop.languages.en}
              onChange={(e) =>
                setShop({
                  ...shop,
                  languages: { ...shop.languages, en: e.target.checked },
                })
              }
              className="accent-amber"
            />{" "}
            English
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={shop.languages.ta}
              onChange={(e) =>
                setShop({
                  ...shop,
                  languages: { ...shop.languages, ta: e.target.checked },
                })
              }
              className="accent-amber"
            />{" "}
            Tamil
          </label>
          <label className="flex items-center gap-2 text-muted">
            <input
              type="checkbox"
              checked={shop.languages.hi}
              onChange={(e) =>
                setShop({
                  ...shop,
                  languages: { ...shop.languages, hi: e.target.checked },
                })
              }
              className="accent-amber"
            />{" "}
            Hindi (later)
          </label>
        </div>
        {error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {msg && (
          <p className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
            {msg}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-amber px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
