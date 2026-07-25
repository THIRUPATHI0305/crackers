const APP = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** Normalize to digits; 10-digit Indian mobiles get 91 prefix. */
export function normalizeWaDigits(phone: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * WhatsApp chat link. Always pass the shop/admin number from Admin → Settings
 * (`shop.whatsapp`) for business chats. Env is only a last-resort fallback.
 */
export function waLink(text: string, to?: string) {
  const digits = normalizeWaDigits(
    to || process.env.WHATSAPP_BUSINESS_NUMBER || ""
  );
  if (!digits) return "#";
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Customer WhatsApp link (admin sends TO customer phone) */
export function waToCustomer(phone: string, text: string) {
  return waLink(text, phone);
}

export function enquiryWhatsApp(
  name: string,
  enquiryNumber: string,
  shopName: string,
  shopWhatsapp: string
) {
  return waLink(
    `Hello ${name},\n\nWe received your enquiry ${enquiryNumber}.\nOur team will confirm stock shortly.\n\nThank you — ${shopName}`,
    shopWhatsapp
  );
}

export function orderStatusWhatsApp(opts: {
  name: string;
  orderNumber: string;
  status: string;
  statusLabel?: string;
  message?: string;
  phone?: string;
  lrUrl?: string;
  feedbackUrl?: string;
  shopName: string;
  shopWhatsapp?: string;
}) {
  const tracking = `${APP}/track-order`;
  const label = opts.statusLabel || opts.status.replaceAll("_", " ");
  let text = `Hello ${opts.name},\n\nYour order ${opts.orderNumber} has been updated.\n\nStatus: ${label}`;

  if (opts.message) text += `\nNote: ${opts.message}`;

  if (opts.status === "PACKED") {
    text += `\n\nYour order is packed and ready for dispatch.`;
  }

  if (opts.status === "SHIPPED") {
    text += `\n\nLorry has been arranged for your order.`;
  }

  if (opts.status === "OUT_FOR_DELIVERY") {
    text += `\n\nYour order is out for delivery.`;
  }

  if (opts.status === "DELIVERED") {
    text += `\n\nYour order has been marked as delivered. Thank you for shopping with us!`;
    if (opts.feedbackUrl) {
      text += `\n\nPlease share your feedback:\n${opts.feedbackUrl}`;
    }
  }

  if (opts.status === "LR_SENT" && opts.lrUrl) {
    text += `\n\nLR / transport copy for your order:\n${opts.lrUrl.startsWith("http") ? opts.lrUrl : `${APP}${opts.lrUrl}`}`;
  }

  text += `\n\nTrack order:\n${tracking}\n\n— ${opts.shopName}`;

  if (opts.phone) return waToCustomer(opts.phone, text);
  return waLink(text, opts.shopWhatsapp);
}

/** Admin Billing / Invoices → customer: tax invoice + order + pay page link */
export function invoiceWhatsApp(opts: {
  name: string;
  invoiceNumber: string;
  total: number;
  token: string;
  shopName: string;
  customerPhone?: string;
  shopWhatsapp?: string;
  upiId?: string;
  /** Linked order number e.g. ORD-2026-0001 */
  orderNumber?: string;
  enquiryNumber?: string;
}) {
  const billUrl = `${APP}/invoice/${opts.token}`;
  const payUrl = `${APP}/pay/${opts.token}`;
  const trackUrl = `${APP}/track-order`;
  const amount = Math.round(opts.total);

  // WhatsApp cannot hide URLs behind custom HTML text — use short https
  // links with clear labels (no raw upi:// in the chat).
  let text = `Hello ${opts.name},\n\nTax invoice from *${opts.shopName}*.\n\nInvoice: ${opts.invoiceNumber}\nAmount: ₹${amount}`;

  if (opts.orderNumber) {
    text += `\nOrder: ${opts.orderNumber}`;
  }

  text += `\n\n📄 *View / download bill*\n${billUrl}`;

  if (opts.orderNumber) {
    text += `\n\n📦 *Track order*\n${trackUrl}`;
  }

  if (opts.upiId) {
    text += `\n\n💳 *Pay via UPI* (GPay / PhonePe / Paytm)\nTap to open pay page:\n${payUrl}`;
  }

  text += `\n\nThank you — ${opts.shopName}`;
  if (opts.customerPhone) return waToCustomer(opts.customerPhone, text);
  return waLink(text, opts.shopWhatsapp);
}

export function feedbackPageUrl(orderNumber: string, phone: string) {
  const digits = phone.replace(/\D/g, "");
  const q = new URLSearchParams({
    order: orderNumber,
    phone:
      digits.length === 12 && digits.startsWith("91")
        ? digits.slice(2)
        : digits,
  });
  return `${APP}/feedback?${q.toString()}`;
}
