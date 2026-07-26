"use client";

import { useState, type FormEvent } from "react";
import { fieldErrorsFromZod, useCsrf } from "@/lib/use-csrf";
import {
  applyBindingDetails,
  useCustomerAutofill,
} from "@/lib/use-customer-autofill";
import { emailSchema, phone10Schema } from "@/lib/validation";
import { PhoneField, TextField } from "@/components/forms/Fields";
import { OtpVerifyBlock } from "@/components/forms/OtpVerifyBlock";

export default function LoyaltyPage() {
  const { withCsrf, ready } = useCsrf();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [emailLocked, setEmailLocked] = useState(false);
  const [invoice, setInvoice] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [data, setData] = useState<{
    name: string | null;
    availablePoints: number;
    earnedPoints: number;
    redeemedPoints: number;
    rewardMessage: string;
  } | null>(null);
  const [error, setError] = useState("");

  const { lookingUp: lookingUpCustomer, hint: customerHint } =
    useCustomerAutofill(phone, withCsrf, ready, (profile) => {
      if (!profile) {
        setEmailLocked(false);
        return;
      }
      if (profile.email) {
        setEmail(profile.email.slice(0, 120));
        setEmailLocked(profile.emailLocked);
        setChallengeId("");
        setOtp("");
      } else {
        setEmailLocked(false);
      }
    });

  async function requestOtp() {
    setError("");
    setFieldErrors({});
    const phoneParsed = phone10Schema.safeParse(phone);
    if (!phoneParsed.success) {
      setFieldErrors({
        phone: phoneParsed.error.issues[0]?.message || "Invalid phone",
      });
      return null;
    }
    const emailParsed = emailSchema.safeParse(email);
    if (!emailParsed.success) {
      setFieldErrors({
        email: emailParsed.error.issues[0]?.message || "Invalid email",
      });
      return null;
    }
    try {
      const init = await withCsrf({
        method: "POST",
        body: JSON.stringify({
          phone,
          email: emailParsed.data,
          purpose: "LOYALTY",
        }),
      });
      const res = await fetch("/api/otp/send", init);
      const json = await res.json();
      if (!res.ok) {
        applyBindingDetails(json, {
          setEmail: (v) => setEmail(v.slice(0, 120)),
          setEmailLocked,
        });
        setError(json?.error?.message || "Could not send OTP");
        setFieldErrors(fieldErrorsFromZod(json?.error || {}));
        return null;
      }
      return {
        challengeId: json.challengeId as string,
        debugCode: json.debugCode as string | undefined,
        expiresInSeconds: json.expiresInSeconds as number | undefined,
        resendAfterSeconds: json.resendAfterSeconds as number | undefined,
        delivery: json.delivery as
          | { ok: boolean; channel: string; message: string }
          | undefined,
      };
    } catch {
      setError("Network error sending OTP");
      return null;
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);
    try {
      const payload: Record<string, string> = { phone };
      if (invoice.trim()) {
        payload.invoiceNumber = invoice.trim().toUpperCase();
      } else {
        const emailParsed = emailSchema.safeParse(email);
        if (!emailParsed.success) {
          setFieldErrors({
            email: emailParsed.error.issues[0]?.message || "Invalid email",
          });
          setError("Enter the email linked to this mobile");
          setLoading(false);
          return;
        }
        if (!challengeId || !/^\d{6}$/.test(otp)) {
          setFieldErrors({ otp: "Send OTP and enter the 6-digit code" });
          setError("Verify with email OTP or enter an invoice number");
          setLoading(false);
          return;
        }
        payload.email = emailParsed.data;
        payload.otpChallengeId = challengeId;
        payload.otp = otp;
      }

      const init = await withCsrf({
        method: "POST",
        body: JSON.stringify(payload),
      });
      const res = await fetch("/api/loyalty/check", init);
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message || "Unable to verify";
        setError(msg);
        const fe = fieldErrorsFromZod(json?.error || {});
        if (!fe.otp && /otp/i.test(msg)) fe.otp = msg;
        setFieldErrors(fe);
        setLoading(false);
        return;
      }
      setData(json);
      setLoading(false);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="bg-atmosphere min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold text-navy">
          Loyalty points
        </h1>
        <p className="mt-2 text-muted">
          Enter your mobile — saved email loads automatically. Verify with email
          OTP or your invoice number.
        </p>

        {!data ? (
          <form
            className="mt-8 space-y-4 rounded-3xl border border-border bg-surface p-8 shadow-sm"
            onSubmit={onSubmit}
          >
            <PhoneField
              label="Mobile number *"
              value={phone}
              onChange={(v) => {
                setPhone(v);
                setChallengeId("");
                setOtp("");
              }}
              error={fieldErrors.phone}
              required
            />
            {lookingUpCustomer ? (
              <p className="text-xs text-muted">Loading saved details…</p>
            ) : customerHint ? (
              <p className="text-xs text-success">{customerHint}</p>
            ) : null}

            {!invoice.trim() && (
              <>
                <TextField
                  label="Email *"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    if (emailLocked) return;
                    setEmail(e.target.value.slice(0, 120));
                    setChallengeId("");
                    setOtp("");
                  }}
                  error={fieldErrors.email}
                  autoComplete="email"
                  maxLength={120}
                  placeholder={
                    emailLocked
                      ? "Registered email for this mobile"
                      : "Must match the email linked to this mobile"
                  }
                  required
                  readOnly={emailLocked}
                  className={
                    emailLocked
                      ? "cursor-not-allowed bg-surface-muted/80 text-navy"
                      : undefined
                  }
                />
                {emailLocked ? (
                  <p className="text-xs text-muted">
                    Email is locked to this mobile.
                  </p>
                ) : null}
              </>
            )}

            <TextField
              label="Invoice number (optional)"
              value={invoice}
              onChange={(e) =>
                setInvoice(e.target.value.slice(0, 20).toUpperCase())
              }
              placeholder="INV-YYYY-####"
              error={fieldErrors.invoiceNumber}
              maxLength={20}
            />

            {!invoice.trim() && (
              <OtpVerifyBlock
                ready={phone.length === 10 && email.includes("@")}
                csrfReady={ready}
                onSend={requestOtp}
                otp={otp}
                onOtpChange={setOtp}
                challengeId={challengeId}
                onChallengeId={setChallengeId}
                error={fieldErrors.otp}
              />
            )}

            {error && (
              <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-amber py-3.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {loading ? "Checking…" : "Check points"}
            </button>
          </form>
        ) : (
          <div className="mt-8 rounded-3xl border border-border bg-gradient-to-br from-navy to-navy-soft p-8 text-white">
            <p className="text-sm text-white/70">Hello {data.name || "Customer"}</p>
            <p className="mt-4 font-[family-name:var(--font-display)] text-5xl font-semibold">
              {data.availablePoints}
            </p>
            <p className="mt-1 text-sm text-white/80">Available points</p>
            <p className="mt-6 text-sm text-white/80">{data.rewardMessage}</p>
            <p className="mt-4 text-xs text-white/60">
              Earned {data.earnedPoints} · Redeemed {data.redeemedPoints}
            </p>
            <button
              type="button"
              onClick={() => {
                setData(null);
                setOtp("");
                setChallengeId("");
              }}
              className="mt-8 rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/25"
            >
              Check another number
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
