import nodemailer, { type Transporter } from "nodemailer";
import { after } from "next/server";
import {
  getOtpProviderSettings,
  isEmailOtpConfigured,
  type OtpProviderSettings,
} from "@/lib/otp-settings";
import { getShopSettings } from "@/lib/shop-settings";

export type ShopMailResult = {
  ok: boolean;
  message: string;
};

function fromHeader(fromEmail: string, shopName?: string) {
  const name = (shopName || "").trim() || "Shop";
  const safe = name.replace(/"/g, "");
  return `"${safe}" <${fromEmail}>`;
}

/**
 * Gmail often accepts mail From=To but only puts it in Sent (not Inbox).
 * Use +alias so the alert shows in Inbox for the same account.
 */
function inboxDeliveryAddress(to: string, fromEmail: string) {
  const dest = to.trim().toLowerCase();
  const from = fromEmail.trim().toLowerCase();
  if (!dest.includes("@") || dest !== from) return to.trim();
  const [user, domain] = dest.split("@");
  if (!user || !domain) return to.trim();
  if (domain === "gmail.com" || domain === "googlemail.com") {
    if (user.includes("+")) return to.trim();
    return `${user}+enquiry@${domain}`;
  }
  return to.trim();
}

/** Reuse one SMTP connection — avoids slow Gmail reconnect on every enquiry. */
let cachedTransport: {
  key: string;
  transporter: Transporter;
} | null = null;

function smtpTransport(settings: OtpProviderSettings): Transporter {
  const pass = settings.smtpPass.replace(/\s+/g, "");
  const user = (settings.smtpUser || settings.emailFrom).trim();
  const host = (settings.smtpHost || "smtp.gmail.com").trim();
  const port = settings.smtpPort || 465;
  const key = `${host}|${port}|${user}|${pass.slice(0, 4)}`;
  if (cachedTransport?.key === key) return cachedTransport.transporter;

  const isGmail =
    host.includes("gmail.com") ||
    host.includes("googlemail.com") ||
    user.toLowerCase().endsWith("@gmail.com");

  // Prefer SMTPS 465 — usually faster than STARTTLS 587 on Gmail
  const use465 = port === 465 || (isGmail && port === 587);
  const transporter = nodemailer.createTransport({
    host: isGmail ? "smtp.gmail.com" : host,
    port: use465 ? 465 : port,
    secure: use465,
    auth: { user, pass },
    pool: true,
    maxConnections: 1,
    maxMessages: 50,
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
    tls: { rejectUnauthorized: true },
  });

  cachedTransport = { key, transporter };
  return transporter;
}

async function sendRawEmail(opts: {
  to: string;
  subject: string;
  text: string;
  settings: OtpProviderSettings;
  shopName: string;
}): Promise<ShopMailResult> {
  const { subject, text, settings, shopName } = opts;
  const user = (settings.smtpUser || settings.emailFrom).trim();
  const fromEmail = (settings.emailFrom || user).trim();
  const from = fromHeader(fromEmail, shopName);
  const to = inboxDeliveryAddress(opts.to, fromEmail);

  if (settings.emailFrom && settings.smtpPass && settings.smtpHost) {
    const transporter = smtpTransport(settings);
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      // Helps some clients treat it as a new alert, not a self-copy
      headers: {
        "X-SparkNova-Notify": "enquiry",
        "Auto-Submitted": "auto-generated",
      },
    });
    const id = info.messageId || "";
    return {
      ok: true,
      message: `Emailed ${to}${id ? ` (${id})` : ""}`,
    };
  }

  if (settings.resendApiKey && settings.emailFrom) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      return {
        ok: false,
        message: data.message || `Resend HTTP ${res.status}`,
      };
    }
    return { ok: true, message: `Emailed ${to}` };
  }

  return {
    ok: false,
    message: "Email not configured (Admin → Settings → OTP Email)",
  };
}

/**
 * Notify shop email (Admin → Settings → Email) about a storefront event.
 * Never throws — enquiry/invoice must succeed even if mail fails.
 */
export async function notifyShopEmail(opts: {
  subject: string;
  text: string;
}): Promise<ShopMailResult> {
  try {
    const [shop, settings] = await Promise.all([
      getShopSettings(),
      getOtpProviderSettings(),
    ]);
    const to = (shop.email || "").trim();
    if (!to || !to.includes("@")) {
      return {
        ok: false,
        message: "Shop email not set in Admin → Settings",
      };
    }
    if (!isEmailOtpConfigured(settings)) {
      return {
        ok: false,
        message: "SMTP/Resend not configured — shop notify skipped",
      };
    }
    return await sendRawEmail({
      to,
      subject: opts.subject,
      text: opts.text,
      settings,
      shopName: shop.name || "Shop",
    });
  } catch (e) {
    console.error("[shop-notify] failed", e);
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Notify failed",
    };
  }
}

/** Run after the HTTP response — enquiry stays fast; mail still sends. */
export function scheduleShopNotify(task: () => Promise<ShopMailResult>) {
  after(async () => {
    try {
      const r = await task();
      if (!r.ok) console.warn("[shop-notify]", r.message);
      else console.info("[shop-notify]", r.message);
    } catch (e) {
      console.error("[shop-notify] after() failed", e);
    }
  });
}

export function scheduleShopNewEnquiry(opts: {
  enquiryNumber: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  estimatedAmount: number;
}) {
  const amount = Math.round(opts.estimatedAmount);
  scheduleShopNotify(() =>
    notifyShopEmail({
      subject: `New enquiry ${opts.enquiryNumber} · ₹${amount}`,
      text: [
        `Enquiry: ${opts.enquiryNumber}`,
        `Customer: ${opts.name}`,
        `Phone: ${opts.phone}`,
        `Email: ${opts.email}`,
        `City: ${opts.city}`,
        `Amount: ₹${amount}`,
        "",
        `Verify in Admin → Enquiries, then mark PAID when payment is received.`,
      ].join("\n"),
    })
  );
}

export function scheduleShopNewInvoice(opts: {
  invoiceNumber: string;
  orderNumber?: string | null;
  enquiryNumber?: string | null;
  name: string;
  phone?: string | null;
  grandTotal: number;
  publicToken: string;
}) {
  const app = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const amount = Math.round(opts.grandTotal);
  scheduleShopNotify(() =>
    notifyShopEmail({
      subject: `Bill ${opts.invoiceNumber} · ₹${amount}`,
      text: [
        `Tax invoice created / sent.`,
        "",
        `Invoice: ${opts.invoiceNumber}`,
        opts.orderNumber ? `Order: ${opts.orderNumber}` : null,
        opts.enquiryNumber ? `Enquiry: ${opts.enquiryNumber}` : null,
        `Customer: ${opts.name}`,
        opts.phone ? `Phone: ${opts.phone}` : null,
        `Amount: ₹${amount}`,
        "",
        `Pay link: ${app}/pay/${opts.publicToken}`,
        `Bill: ${app}/invoice/${opts.publicToken}`,
        `Admin: ${app}/admin/invoices`,
      ]
        .filter(Boolean)
        .join("\n"),
    })
  );
}

/** Kept for scripts / manual tests */
export async function notifyShopNewEnquiry(opts: {
  enquiryNumber: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  estimatedAmount: number;
}) {
  const amount = Math.round(opts.estimatedAmount);
  return notifyShopEmail({
    subject: `New enquiry ${opts.enquiryNumber} · ₹${amount}`,
    text: [
      `Enquiry: ${opts.enquiryNumber}`,
      `Customer: ${opts.name}`,
      `Phone: ${opts.phone}`,
      `Email: ${opts.email}`,
      `City: ${opts.city}`,
      `Amount: ₹${amount}`,
    ].join("\n"),
  });
}

export async function notifyShopNewInvoice(opts: {
  invoiceNumber: string;
  orderNumber?: string | null;
  enquiryNumber?: string | null;
  name: string;
  phone?: string | null;
  grandTotal: number;
  publicToken: string;
}) {
  const app = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const amount = Math.round(opts.grandTotal);
  return notifyShopEmail({
    subject: `Bill ${opts.invoiceNumber} · ₹${amount}`,
    text: [
      `Invoice: ${opts.invoiceNumber}`,
      opts.orderNumber ? `Order: ${opts.orderNumber}` : null,
      opts.enquiryNumber ? `Enquiry: ${opts.enquiryNumber}` : null,
      `Customer: ${opts.name}`,
      opts.phone ? `Phone: ${opts.phone}` : null,
      `Amount: ₹${amount}`,
      `Pay: ${app}/pay/${opts.publicToken}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}
