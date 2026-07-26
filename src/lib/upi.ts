const APP = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** Normalize UPI VPA (e.g. shop@oksbi). */
export function normalizeUpiId(upiId: string) {
  return (upiId || "").trim().toLowerCase();
}

/** Common phone-number UPI suffixes (shop receive ID). */
export const PHONE_UPI_PROVIDERS = [
  { id: "phonepe", label: "PhonePe", suffix: "ybl" },
  { id: "paytm", label: "Paytm", suffix: "paytm" },
  { id: "gpay-oksbi", label: "GPay (SBI)", suffix: "oksbi" },
  { id: "gpay-okaxis", label: "GPay (Axis)", suffix: "okaxis" },
  { id: "gpay-okhdfcbank", label: "GPay (HDFC)", suffix: "okhdfcbank" },
] as const;

/** Build `9876543210@ybl` style VPA from 10-digit mobile + provider. */
export function phoneBasedUpiId(phone: string, suffix: string) {
  const digits = (phone || "").replace(/\D/g, "");
  const ten =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith("0")
        ? digits.slice(1)
        : digits;
  if (!/^[6-9]\d{9}$/.test(ten)) return "";
  const host = (suffix || "").replace(/^@/, "").trim().toLowerCase();
  if (!host) return "";
  return `${ten}@${host}`;
}

/**
 * Standard UPI deep link — opens GPay / PhonePe / Paytm on mobile.
 * Amount in INR; omit `am` for customer to enter amount.
 */
export function upiPayLink(opts: {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
}) {
  const pa = normalizeUpiId(opts.upiId);
  if (!pa || !pa.includes("@")) return "";
  const params = new URLSearchParams({
    pa,
    pn: opts.payeeName || "Shop",
    cu: "INR",
  });
  if (opts.amount > 0) {
    params.set("am", opts.amount.toFixed(2));
  }
  if (opts.note) params.set("tn", opts.note.slice(0, 50));
  return `upi://pay?${params.toString()}`;
}

/**
 * Google Pay / PhonePe / Paytm app deep links (same payee + amount).
 * Falls back to generic upi:// when the app isn't installed.
 */
export function upiAppLinks(opts: {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
}) {
  const upi = upiPayLink(opts);
  if (!upi) return null;
  const q = upi.replace(/^upi:\/\/pay\?/, "");
  return {
    upi,
    gpay: `tez://upi/pay?${q}`,
    phonepe: `phonepe://pay?${q}`,
    paytm: `paytmmp://upi/pay?${q}`,
  };
}

export function invoicePageUrl(tokenOrNumber: string) {
  return `${APP}/invoice/${encodeURIComponent(tokenOrNumber)}`;
}
