const APP = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** Normalize UPI VPA (e.g. shop@oksbi). */
export function normalizeUpiId(upiId: string) {
  return (upiId || "").trim().toLowerCase();
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
 * Google Pay intent / web-friendly share URL for WhatsApp.
 * Uses the same VPA; Android GPay opens via upi:// — also expose a https mirror.
 */
export function gpayUpiLink(opts: {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
}) {
  const upi = upiPayLink(opts);
  if (!upi) return "";
  // GPay Android package intent (works when pasted on phone)
  const q = upi.replace(/^upi:\/\/pay\?/, "");
  return `tez://upi/pay?${q}`;
}

export function invoicePageUrl(tokenOrNumber: string) {
  return `${APP}/invoice/${encodeURIComponent(tokenOrNumber)}`;
}
