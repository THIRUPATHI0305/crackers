import { prisma } from "@/lib/prisma";
import { getShopSettings } from "@/lib/shop-settings";

export type OtpProviderSettings = {
  /** Company email — OTP emails are sent FROM this address */
  emailFrom: string;
  /** SMTP host (Gmail: smtp.gmail.com) */
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  /** Optional Resend API key (alternative to SMTP) */
  resendApiKey: string;
  /** Preferred SMS: AuthKey 2FA */
  authkeyAuthKey: string;
  authkeySid: string;
  /** Fallback SMS: Fast2SMS */
  fast2smsApiKey: string;
};

const DEFAULT_OTP: OtpProviderSettings = {
  emailFrom: "",
  smtpHost: "smtp.gmail.com",
  smtpPort: 587,
  smtpUser: "",
  smtpPass: "",
  resendApiKey: "",
  authkeyAuthKey: "",
  authkeySid: "",
  fast2smsApiKey: "",
};

function fromEnv(): Partial<OtpProviderSettings> {
  return {
    emailFrom:
      process.env.EMAIL_FROM?.trim() || process.env.RESEND_FROM?.trim() || "",
    smtpHost: process.env.SMTP_HOST?.trim() || "",
    smtpPort: Number(process.env.SMTP_PORT) || 0,
    smtpUser: process.env.SMTP_USER?.trim() || "",
    smtpPass: process.env.SMTP_PASS?.trim() || "",
    resendApiKey: process.env.RESEND_API_KEY?.trim() || "",
    authkeyAuthKey: process.env.AUTHKEY_AUTH_KEY?.trim() || "",
    authkeySid: process.env.AUTHKEY_SID?.trim() || "",
    fast2smsApiKey: process.env.FAST2SMS_API_KEY?.trim() || "",
  };
}

export async function getOtpProviderSettings(): Promise<OtpProviderSettings> {
  const env = fromEnv();
  const shop = await getShopSettings();
  const row = await prisma.setting.findUnique({ where: { key: "otp" } });

  let parsed: Partial<OtpProviderSettings> = {};
  if (row) {
    try {
      parsed = JSON.parse(row.value) as Partial<OtpProviderSettings>;
    } catch {
      parsed = {};
    }
  }

  const emailFrom =
    (parsed.emailFrom || "").trim() ||
    (env.emailFrom || "").trim() ||
    (shop.email || "").trim();

  return {
    emailFrom,
    smtpHost:
      (parsed.smtpHost || "").trim() ||
      (env.smtpHost || "").trim() ||
      "smtp.gmail.com",
    smtpPort: Number(parsed.smtpPort) || Number(env.smtpPort) || 587,
    smtpUser:
      (parsed.smtpUser || "").trim() ||
      (env.smtpUser || "").trim() ||
      emailFrom,
    smtpPass: (
      (parsed.smtpPass || "").trim() ||
      (env.smtpPass || "").trim()
    ).replace(/\s+/g, ""),
    resendApiKey:
      (parsed.resendApiKey || "").trim() || (env.resendApiKey || "").trim(),
    authkeyAuthKey:
      (parsed.authkeyAuthKey || "").trim() || (env.authkeyAuthKey || "").trim(),
    authkeySid:
      (parsed.authkeySid || "").trim() || (env.authkeySid || "").trim(),
    fast2smsApiKey:
      (parsed.fast2smsApiKey || "").trim() || (env.fast2smsApiKey || "").trim(),
  };
}

export function maskApiKey(key: string) {
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  return `${"•".repeat(Math.min(12, key.length - 4))}${key.slice(-4)}`;
}

export function isEmailOtpConfigured(otp: OtpProviderSettings) {
  const smtpOk = Boolean(otp.emailFrom && otp.smtpPass && otp.smtpHost);
  const resendOk = Boolean(otp.resendApiKey && otp.emailFrom);
  const webhookOk = Boolean(process.env.OTP_EMAIL_WEBHOOK_URL?.trim());
  return smtpOk || resendOk || webhookOk;
}

export async function getOtpSettingsPublic() {
  const otp = await getOtpProviderSettings();
  const emailConfigured = isEmailOtpConfigured(otp);
  const smtpConfigured = Boolean(otp.emailFrom && otp.smtpPass && otp.smtpHost);
  const resendConfigured = Boolean(otp.resendApiKey && otp.emailFrom);
  const authkeyConfigured = Boolean(otp.authkeyAuthKey && otp.authkeySid);
  const fast2smsConfigured = Boolean(otp.fast2smsApiKey);

  let provider: "email" | "authkey" | "fast2sms" | "none" = "none";
  if (emailConfigured) provider = "email";
  else if (authkeyConfigured) provider = "authkey";
  else if (fast2smsConfigured) provider = "fast2sms";

  return {
    provider,
    emailConfigured,
    emailFromHint: otp.emailFrom || "",
    smtpConfigured,
    smtpHostHint: otp.smtpHost || "",
    smtpUserHint: otp.smtpUser ? maskApiKey(otp.smtpUser) : "",
    smtpPassHint: otp.smtpPass ? maskApiKey(otp.smtpPass) : "",
    resendConfigured,
    resendApiKeyHint: resendConfigured ? maskApiKey(otp.resendApiKey) : "",
    authkeyConfigured,
    authkeyAuthKeyHint: authkeyConfigured
      ? maskApiKey(otp.authkeyAuthKey)
      : "",
    authkeySidHint: otp.authkeySid ? String(otp.authkeySid) : "",
    fast2smsConfigured,
    fast2smsApiKeyHint: fast2smsConfigured
      ? maskApiKey(otp.fast2smsApiKey)
      : "",
    envConfigured: Boolean(
      process.env.RESEND_API_KEY?.trim() ||
        process.env.SMTP_PASS?.trim() ||
        (process.env.AUTHKEY_AUTH_KEY?.trim() &&
          process.env.AUTHKEY_SID?.trim()) ||
        process.env.FAST2SMS_API_KEY?.trim()
    ),
  };
}

export { DEFAULT_OTP };
