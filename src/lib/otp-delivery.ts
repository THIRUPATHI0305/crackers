import nodemailer from "nodemailer";
import { OTP_TTL_SECONDS } from "@/lib/otp-constants";
import {
  getOtpProviderSettings,
  isEmailOtpConfigured,
  type OtpProviderSettings,
} from "@/lib/otp-settings";
import { getShopSettings } from "@/lib/shop-settings";

export type OtpDeliveryResult = {
  ok: boolean;
  channel: "email" | "authkey" | "fast2sms" | "webhook" | "dev";
  message: string;
  /** AuthKey 2FA session id — required for AuthKey verify */
  logId?: string;
  /** True when SMTP/API failed due to DNS / connectivity */
  networkError?: boolean;
};

/** Normalize stored 91XXXXXXXXXX (or 10-digit) → 10-digit for SMS APIs. */
export function toIndiaMobile10(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 10) return d;
  return d.slice(-10);
}

function fromHeader(fromEmail: string, shopName?: string) {
  const name = (shopName || "").trim() || "OTP";
  // Avoid breaking header if name has quotes
  const safe = name.replace(/"/g, "");
  return `"${safe}" <${fromEmail}>`;
}

async function sendViaSmtp(
  to: string,
  code: string,
  purpose: string,
  settings: OtpProviderSettings,
  shopName: string
): Promise<OtpDeliveryResult> {
  // Gmail app passwords are often copied with spaces (xxxx xxxx xxxx xxxx)
  const pass = settings.smtpPass.replace(/\s+/g, "");
  const user = (settings.smtpUser || settings.emailFrom).trim();
  const host = (settings.smtpHost || "smtp.gmail.com").trim();
  const isGmail =
    host.includes("gmail.com") ||
    host.includes("googlemail.com") ||
    user.toLowerCase().endsWith("@gmail.com");

  const transporter = isGmail
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
      })
    : nodemailer.createTransport({
        host,
        port: settings.smtpPort || 587,
        secure: settings.smtpPort === 465,
        auth: { user, pass },
      });

  const subject = `Your verification OTP (${OTP_TTL_SECONDS / 60} min)`;
  const text = `Your OTP is ${code}. It is valid for ${OTP_TTL_SECONDS / 60} minutes. Do not share this code.\n\n— ${shopName || "Shop"}`;

  try {
    await transporter.sendMail({
      from: fromHeader(settings.emailFrom || user, shopName),
      to,
      subject,
      text,
    });
    return {
      ok: true,
      channel: "email",
      message: `OTP emailed to ${maskEmail(to)} (valid ${OTP_TTL_SECONDS / 60} min)`,
    };
  } catch (e) {
    console.error("[OTP:email:smtp] failed", e);
    const msg = e instanceof Error ? e.message : "SMTP send failed";
    const badCreds =
      /535|BadCredentials|Username and Password not accepted|Invalid login/i.test(
        msg
      );
    const networkFail =
      /ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ECONNRESET|network|getaddrinfo|socket/i.test(
        msg
      );
    if (badCreds && isGmail) {
      return {
        ok: false,
        channel: "email",
        message:
          "Gmail login failed. Use a 16-character App Password (not your normal Gmail password): Google Account → Security → 2-Step Verification → App passwords. Paste it in Admin → Settings → OTP Email, then Save.",
      };
    }
    if (networkFail) {
      return {
        ok: false,
        channel: "email",
        message:
          "Can't reach the email server (check internet / DNS). On-screen Dev OTP will be shown so you can continue.",
        networkError: true,
      };
    }
    return {
      ok: false,
      channel: "email",
      message: `Could not send OTP email via company SMTP (${msg}). Check Admin → Settings → OTP Email.`,
    };
  }
}

async function sendViaResend(
  to: string,
  code: string,
  purpose: string,
  settings: OtpProviderSettings,
  shopName: string
): Promise<OtpDeliveryResult> {
  const subject = `Your verification OTP (${OTP_TTL_SECONDS / 60} min)`;
  const text = `Your OTP is ${code}. It is valid for ${OTP_TTL_SECONDS / 60} minutes. Do not share this code.\n\n— ${shopName || "Shop"} (${purpose})`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromHeader(settings.emailFrom, shopName),
      to: [to],
      subject,
      text,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    name?: string;
  };
  if (!res.ok) {
    console.error("[OTP:email:resend] failed", data);
    return {
      ok: false,
      channel: "email",
      message:
        data.message ||
        data.name ||
        "Email OTP provider rejected the request — check Resend key / company email",
    };
  }
  return {
    ok: true,
    channel: "email",
    message: `OTP emailed to ${maskEmail(to)} (valid ${OTP_TTL_SECONDS / 60} min)`,
  };
}

async function sendViaEmail(
  email: string,
  code: string,
  purpose: string
): Promise<OtpDeliveryResult> {
  const settings = await getOtpProviderSettings();
  const shop = await getShopSettings();
  const webhook = process.env.OTP_EMAIL_WEBHOOK_URL?.trim() || "";

  // Prefer company SMTP from Admin → Settings (Gmail app password, etc.)
  if (settings.emailFrom && settings.smtpPass && settings.smtpHost) {
    return sendViaSmtp(email, code, purpose, settings, shop.name);
  }

  if (settings.resendApiKey && settings.emailFrom) {
    return sendViaResend(email, code, purpose, settings, shop.name);
  }

  if (webhook) {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, purpose, channel: "email" }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      return {
        ok: false,
        channel: "email",
        message: `Email webhook HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      channel: "email",
      message: `OTP emailed to ${maskEmail(email)} (valid ${OTP_TTL_SECONDS / 60} min)`,
    };
  }

  return {
    ok: false,
    channel: "email",
    message:
      "Email OTP not configured. Add company email + Gmail app password in Admin → Settings → OTP Email.",
  };
}

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${"•".repeat(Math.max(2, user.length - 2))}@${domain}`;
}

/**
 * AuthKey 2FA send — AuthKey generates the OTP ({#2fa#} in template).
 * Docs: https://authkey.io/2fa-api-docs
 */
async function sendViaAuthkey(
  phone10: string,
  authkey: string,
  sid: string
): Promise<OtpDeliveryResult> {
  const url = new URL("https://api.authkey.io/request");
  url.searchParams.set("authkey", authkey);
  url.searchParams.set("mobile", phone10);
  url.searchParams.set("country_code", "91");
  url.searchParams.set("sid", sid);

  const res = await fetch(url.toString(), {
    method: "GET",
    signal: AbortSignal.timeout(15_000),
  });

  const data = (await res.json().catch(() => ({}))) as {
    LogID?: string;
    logid?: string;
    logId?: string;
    Message?: string;
    message?: string;
    status?: string | boolean;
  };

  const logId = data.LogID || data.logid || data.logId || "";
  const rawMsg = data.Message || data.message || res.statusText;
  const ok = Boolean(logId) && res.ok;

  if (!ok) {
    console.error("[OTP:authkey] failed", data);
    return {
      ok: false,
      channel: "authkey",
      message: String(
        rawMsg || "AuthKey rejected the request — check authkey / SID / balance"
      ),
    };
  }

  return {
    ok: true,
    channel: "authkey",
    logId,
    message: `OTP SMS sent via AuthKey (valid ${OTP_TTL_SECONDS / 60} min)`,
  };
}

/** AuthKey 2FA verify — https://authkey.io/2fa-api-docs */
export async function verifyAuthkeyOtp(
  logId: string,
  otp: string
): Promise<{ ok: boolean; message: string }> {
  const settings = await getOtpProviderSettings();
  if (!settings.authkeyAuthKey) {
    return { ok: false, message: "AuthKey not configured" };
  }

  const url = new URL("https://authkey.io/api/2fa_verify.php");
  url.searchParams.set("authkey", settings.authkeyAuthKey);
  url.searchParams.set("channel", "sms");
  url.searchParams.set("otp", otp);
  url.searchParams.set("logid", logId);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(12_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      status?: boolean | string;
      message?: string;
      Message?: string;
    };
    const statusOk =
      data.status === true ||
      data.status === "true" ||
      String(data.message || data.Message || "")
        .toLowerCase()
        .includes("valid");

    if (!statusOk) {
      return {
        ok: false,
        message: String(data.message || data.Message || "Incorrect OTP"),
      };
    }
    return { ok: true, message: String(data.message || "Valid OTP") };
  } catch (e) {
    console.error("[OTP:authkey-verify] error", e);
    return { ok: false, message: "AuthKey verify network error" };
  }
}

async function sendViaFast2Sms(
  phone10: string,
  code: string,
  apiKey: string
): Promise<OtpDeliveryResult> {
  const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: {
      authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      route: "otp",
      variables_values: code,
      numbers: phone10,
      flash: 0,
    }),
    signal: AbortSignal.timeout(12_000),
  });

  const data = (await res.json().catch(() => ({}))) as {
    return?: boolean;
    status_code?: number;
    message?: string | string[];
  };

  const ok = res.ok && data.return === true;
  const rawMsg = Array.isArray(data.message)
    ? data.message.join(", ")
    : data.message || res.statusText;

  if (!ok) {
    console.error("[OTP:fast2sms] failed", data);
    return {
      ok: false,
      channel: "fast2sms",
      message:
        rawMsg || "Fast2SMS rejected the request — check API key / balance",
    };
  }

  return {
    ok: true,
    channel: "fast2sms",
    message: `OTP SMS sent to mobile (valid ${OTP_TTL_SECONDS / 60} min)`,
  };
}

async function sendViaWebhook(
  phone: string,
  code: string,
  purpose: string,
  email?: string
): Promise<OtpDeliveryResult> {
  const url = process.env.OTP_WEBHOOK_URL?.trim();
  if (!url) {
    return { ok: false, channel: "webhook", message: "No webhook" };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, email, code, purpose }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    return {
      ok: false,
      channel: "webhook",
      message: `Webhook HTTP ${res.status}`,
    };
  }
  return {
    ok: true,
    channel: "webhook",
    message: "OTP sent via webhook",
  };
}

function emailOtpConfigured(settings: OtpProviderSettings) {
  return isEmailOtpConfigured(settings);
}

/**
 * Deliver OTP — prefer email (one phone ↔ one email).
 * Priority: Email → AuthKey SMS → Fast2SMS → webhook → on-screen Dev OTP.
 * Network failures fall through so Dev OTP still works offline.
 */
export async function deliverOtp(
  phone: string,
  code: string,
  purpose: string,
  email?: string
): Promise<OtpDeliveryResult> {
  const phone10 = toIndiaMobile10(phone);
  const settings = await getOtpProviderSettings();
  let lastSoftFail: OtpDeliveryResult | null = null;

  if (email && emailOtpConfigured(settings)) {
    try {
      const result = await sendViaEmail(email, code, purpose);
      if (result.ok) return result;
      // Network / unreachable: keep going so Dev OTP can be shown
      if (result.networkError) {
        lastSoftFail = result;
      } else if (result.message !== "Email OTP not configured") {
        // Auth errors etc. — still allow Dev OTP fallback below
        lastSoftFail = result;
      }
    } catch (e) {
      console.error("[OTP:email] error", e);
      lastSoftFail = {
        ok: false,
        channel: "email",
        networkError: true,
        message:
          "Can't reach the email server (check internet). On-screen Dev OTP will be shown.",
      };
    }
  }

  if (settings.authkeyAuthKey && settings.authkeySid) {
    try {
      const result = await sendViaAuthkey(
        phone10,
        settings.authkeyAuthKey,
        settings.authkeySid
      );
      if (result.ok) return result;
      lastSoftFail = result;
    } catch (e) {
      console.error("[OTP:authkey] error", e);
      lastSoftFail = {
        ok: false,
        channel: "authkey",
        networkError: true,
        message: "AuthKey network error",
      };
    }
  }

  if (settings.fast2smsApiKey) {
    try {
      const result = await sendViaFast2Sms(
        phone10,
        code,
        settings.fast2smsApiKey
      );
      if (result.ok) return result;
      lastSoftFail = result;
    } catch (e) {
      console.error("[OTP:fast2sms] error", e);
      lastSoftFail = {
        ok: false,
        channel: "fast2sms",
        networkError: true,
        message: "Fast2SMS network error",
      };
    }
  }

  if (process.env.OTP_WEBHOOK_URL?.trim()) {
    try {
      const result = await sendViaWebhook(phone, code, purpose, email);
      if (result.ok) return result;
      lastSoftFail = result;
    } catch (e) {
      console.error("[OTP:webhook] error", e);
      lastSoftFail = {
        ok: false,
        channel: "webhook",
        networkError: true,
        message: "Webhook network error",
      };
    }
  }

  console.info(
    `[OTP:${purpose}] ${phone}${email ? ` / ${email}` : ""} → ${code} (dev fallback)`
  );

  const hint = lastSoftFail?.networkError
    ? "Check your internet connection. "
    : lastSoftFail
      ? `${lastSoftFail.message} `
      : "";

  return {
    ok: true,
    channel: "dev",
    networkError: lastSoftFail?.networkError,
    message: email
      ? `${hint}Use the on-screen Dev OTP below.`
      : `${hint}No OTP API configured. Use the on-screen Dev OTP.`,
  };
}
