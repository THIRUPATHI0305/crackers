"use client";

import { useEffect, useRef, useState } from "react";
import {
  OTP_RESEND_SECONDS,
  formatOtpCountdown,
} from "@/lib/otp-constants";
import { FieldError, OtpField } from "@/components/forms/Fields";

type DeliveryInfo = {
  ok: boolean;
  channel: string;
  message: string;
  networkError?: boolean;
};

type Props = {
  /** Phone + email ready for OTP */
  ready: boolean;
  csrfReady: boolean;
  onSend: () => Promise<{
    challengeId: string;
    debugCode?: string;
    expiresInSeconds?: number;
    resendAfterSeconds?: number;
    delivery?: DeliveryInfo;
  } | null>;
  otp: string;
  onOtpChange: (otp: string) => void;
  challengeId: string;
  onChallengeId: (id: string) => void;
  error?: string;
  challengeError?: string;
};

export function OtpVerifyBlock({
  ready,
  csrfReady,
  onSend,
  otp,
  onOtpChange,
  challengeId,
  onChallengeId,
  error,
  challengeError,
}: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [debugCode, setDebugCode] = useState("");
  const [delivery, setDelivery] = useState<DeliveryInfo | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);
  const [localError, setLocalError] = useState("");
  const timerRef = useRef<number | null>(null);
  const onOtpChangeRef = useRef(onOtpChange);
  onOtpChangeRef.current = onOtpChange;

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  function startTimers(resendAfter: number, validFor: number) {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setCooldown(resendAfter);
    setExpiresIn(validFor);
    timerRef.current = window.setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
      setExpiresIn((e) => {
        const next = Math.max(0, e - 1);
        if (next === 0 && e > 0) {
          // Defer parent update — never setState on parent inside this updater
          queueMicrotask(() => {
            setLocalError("OTP expired after 2 minutes. Tap Resend OTP.");
            onOtpChangeRef.current("");
          });
        }
        return next;
      });
    }, 1000);
  }

  async function handleSend() {
    setLocalError("");
    setSending(true);
    try {
      const result = await onSend();
      if (!result) return;
      onChallengeId(result.challengeId);
      setSent(true);
      onOtpChange("");
      setDebugCode(result.debugCode || "");
      setDelivery(result.delivery || null);
      startTimers(
        result.resendAfterSeconds ?? OTP_RESEND_SECONDS,
        result.expiresInSeconds ?? OTP_RESEND_SECONDS
      );
    } finally {
      setSending(false);
    }
  }

  const canSend = csrfReady && ready && !sending && cooldown === 0;
  const otpExpired = sent && expiresIn === 0;
  const showResend = sent && cooldown === 0;
  const emailLive = delivery?.channel === "email" && delivery.ok;
  const smsLive =
    (delivery?.channel === "fast2sms" || delivery?.channel === "authkey") &&
    delivery.ok;

  return (
    <div className="rounded-xl border border-border bg-surface-muted/50 p-4">
      <p className="text-sm font-bold text-navy">Verify email OTP</p>
      <p className="mt-1 text-xs text-muted">
        OTP is sent to your email. One mobile number can use only one email.
        Code is valid for <strong>2 minutes</strong>.
      </p>

      {!sent || showResend ? (
        <button
          type="button"
          disabled={!canSend}
          onClick={handleSend}
          className="mt-3 w-full rounded-full border border-navy bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {sending
            ? "Sending…"
            : showResend
              ? "Resend OTP"
              : "Send OTP"}
        </button>
      ) : (
        <p className="mt-3 rounded-lg bg-navy/5 px-3 py-2 text-center text-sm font-semibold text-navy">
          Resend OTP in {formatOtpCountdown(cooldown)}
        </p>
      )}

      {sent && (
        <div className="mt-3 space-y-2">
          {delivery ? (
            <p
              className={`text-xs font-medium ${
                delivery.ok && (emailLive || smsLive)
                  ? "text-success"
                  : delivery.channel === "dev" || delivery.networkError
                    ? "text-amber"
                    : delivery.ok
                      ? "text-success"
                      : "text-danger"
              }`}
            >
              {emailLive
                ? "OTP sent to your email"
                : smsLive
                  ? "OTP SMS sent to your mobile"
                  : delivery.networkError
                    ? "Can't reach email server — check your internet. Use the Dev OTP below."
                    : delivery.message}
            </p>
          ) : null}
          {expiresIn > 0 ? (
            <p className="text-xs font-medium text-success">
              OTP valid for {formatOtpCountdown(expiresIn)}
            </p>
          ) : (
            <p className="text-xs font-medium text-danger">
              OTP expired — use Resend OTP
            </p>
          )}
          <OtpField
            value={otp}
            onChange={(v) => {
              setLocalError("");
              onOtpChange(v);
            }}
            error={error || localError}
            disabled={otpExpired}
          />
          {otp.length > 0 && otp.length < 6 ? (
            <p className="text-xs text-muted">Enter all 6 digits</p>
          ) : null}
          {debugCode && !emailLive && !smsLive ? (
            <div className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber">
                Dev OTP (email not delivered)
              </p>
              <p className="mt-1 text-2xl font-bold tracking-[0.2em] text-navy">
                {debugCode}
              </p>
              <p className="mt-1 text-xs text-muted">
                Enter this code above to continue
              </p>
            </div>
          ) : null}
          {!challengeId ? <FieldError message="Send OTP first" /> : null}
          <FieldError message={challengeError} />
        </div>
      )}
    </div>
  );
}
