"use client";

import { useState, type FormEvent } from "react";
import { fieldErrorsFromZod, useCsrf } from "@/lib/use-csrf";
import { contactDraftSchema } from "@/lib/validation";
import {
  PhoneField,
  TextAreaField,
  TextField,
} from "@/components/forms/Fields";
import { OtpVerifyBlock } from "@/components/forms/OtpVerifyBlock";

export function ContactForm() {
  const { withCsrf, ready } = useCsrf();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function requestOtp() {
    setError("");
    setFieldErrors({});
    const parsed = contactDraftSchema.safeParse({ name, phone, email, message });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "_";
        if (!fe[key]) fe[key] = issue.message;
      }
      setFieldErrors(fe);
      setError("Please fix the highlighted fields before sending OTP");
      return null;
    }

    try {
      const init = await withCsrf({
        method: "POST",
        body: JSON.stringify({
          phone: parsed.data.phone,
          email: parsed.data.email,
          purpose: "CONTACT",
        }),
      });
      const res = await fetch("/api/otp/send", init);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Could not send OTP");
        setFieldErrors(fieldErrorsFromZod(data?.error || {}));
        return null;
      }
      setOtpSent(true);
      return {
        challengeId: data.challengeId as string,
        debugCode: data.debugCode as string | undefined,
        expiresInSeconds: data.expiresInSeconds as number | undefined,
        resendAfterSeconds: data.resendAfterSeconds as number | undefined,
        delivery: data.delivery as
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
    const draft = contactDraftSchema.safeParse({ name, phone, email, message });
    if (!draft.success) {
      const fe: Record<string, string> = {};
      for (const issue of draft.error.issues) {
        const key = issue.path.join(".") || "_";
        if (!fe[key]) fe[key] = issue.message;
      }
      setFieldErrors(fe);
      setError("Please fix the highlighted fields");
      return;
    }
    if (!challengeId) {
      setFieldErrors({ otp: "Send OTP first" });
      setError("Verify your email with OTP before sending");
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setFieldErrors({ otp: "Enter the 6-digit OTP" });
      setError("Enter a valid 6-digit OTP");
      return;
    }

    setLoading(true);
    try {
      const init = await withCsrf({
        method: "POST",
        body: JSON.stringify({
          ...draft.data,
          otpChallengeId: challengeId,
          otp,
        }),
      });
      const res = await fetch("/api/contact", init);
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error?.message || "Could not send message";
        setError(msg);
        const fe = fieldErrorsFromZod(data?.error || {});
        if (!fe.otp && /otp/i.test(msg)) fe.otp = msg;
        setFieldErrors(fe);
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-3 rounded-3xl border border-border bg-surface p-8 text-center shadow-sm">
        <p className="text-3xl text-success">✓</p>
        <p className="text-lg font-bold text-navy">Message sent</p>
        <p className="text-sm text-muted">
          Email verified. We will get back to you on WhatsApp or phone soon.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4 rounded-3xl border border-border bg-surface p-8 shadow-sm"
      onSubmit={onSubmit}
    >
      <p className="text-lg font-bold text-navy">Send a message</p>
      <TextField
        label="Your name *"
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 30))}
        error={fieldErrors.name}
        autoComplete="name"
        maxLength={30}
      />
      <PhoneField
        label="Mobile number *"
        value={phone}
        onChange={(v) => {
          setPhone(v);
          setOtpSent(false);
          setChallengeId("");
          setOtp("");
        }}
        error={fieldErrors.phone}
        required
      />
      <TextField
        label="Email *"
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value.slice(0, 120));
          setOtpSent(false);
          setChallengeId("");
          setOtp("");
        }}
        error={fieldErrors.email}
        autoComplete="email"
        maxLength={120}
        placeholder="OTP will be sent here"
        required
      />
      <TextAreaField
        label="How can we help? *"
        rows={5}
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
        error={fieldErrors.message}
        maxLength={1000}
      />

      <OtpVerifyBlock
        ready={
          name.trim().length >= 2 &&
          phone.length === 10 &&
          email.includes("@") &&
          message.trim().length >= 5
        }
        csrfReady={ready}
        onSend={requestOtp}
        otp={otp}
        onOtpChange={setOtp}
        challengeId={challengeId}
        onChallengeId={setChallengeId}
        error={fieldErrors.otp}
        challengeError={fieldErrors.otpChallengeId}
      />

      {error && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={
          loading ||
          !ready ||
          !otpSent ||
          !challengeId ||
          otp.length !== 6
        }
        className="w-full rounded-full bg-amber py-3.5 text-sm font-bold text-white hover:bg-amber-bright disabled:opacity-50"
      >
        {loading ? "Sending…" : "Verify OTP & send message"}
      </button>
    </form>
  );
}
