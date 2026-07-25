"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatInr } from "@/lib/admin-data";
import { AdminSearchBar } from "@/components/admin/AdminSearchBar";
import { invoiceWhatsApp } from "@/lib/whatsapp";

type EnquiryItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  product: {
    id: string;
    nameEn: string;
    code: string;
    originalPrice: number;
    offerPrice: number;
    category?: { nameEn: string; slug: string };
  };
};

type EnquiryInvoice = {
  id: string;
  number: string;
  publicToken: string;
  grandTotal: number;
  customerName?: string | null;
  customerPhone?: string | null;
};

type Enquiry = {
  id: string;
  number: string;
  status: string;
  estimatedAmount: number;
  loyaltyRedeem?: number;
  createdAt: string;
  note: string | null;
  customer: {
    name: string | null;
    phone: string;
    city: string | null;
    email?: string | null;
  };
  items: EnquiryItem[];
  order?: { id: string; number: string } | null;
  invoice?: EnquiryInvoice | null;
  loyaltyPointsAwarded?: number;
  loyaltyPointsForAmount?: number;
  loyaltyPointsIfPaid?: number;
};

const STATUSES = [
  "NEW",
  "CONTACTED",
  "CONFIRMED",
  "PAID",
  "REJECTED",
  "CONVERTED",
  "BILL_SENT",
];

function statusSelectClass(status: string) {
  if (status === "BILL_SENT") return "bg-[#25D366]/15 text-[#128C7E]";
  if (status === "PAID") return "bg-success/15 text-success";
  if (status === "CONVERTED") return "bg-amber/15 text-navy";
  return "bg-surface-muted text-navy";
}

/** Only tax invoice WhatsApp — never enquiry estimate */
function invoiceCustomerWa(e: Enquiry, shopName: string, upiId: string) {
  if (!e.invoice) return null;
  return invoiceWhatsApp({
    name: e.customer.name || e.invoice.customerName || "Customer",
    invoiceNumber: e.invoice.number,
    total: e.invoice.grandTotal,
    token: e.invoice.publicToken,
    shopName,
    customerPhone: e.customer.phone,
    upiId: upiId || undefined,
    orderNumber: e.order?.number,
    enquiryNumber: e.number,
  });
}

export default function AdminEnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [billEnquiry, setBillEnquiry] = useState<Enquiry | null>(null);
  const [shopName, setShopName] = useState("Shop");
  const [shopUpiId, setShopUpiId] = useState("");

  async function load(search = "") {
    try {
      const res = await fetch(
        `/api/admin/enquiries${search ? `?q=${encodeURIComponent(search)}` : ""}`
      );
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (res.ok) setEnquiries(data.enquiries || []);
      else setMsg(data?.error?.message || "Failed to load enquiries");
    } catch {
      setMsg("Failed to load enquiries — restart the server after schema changes");
    }
  }

  useEffect(() => {
    load();
    async function loadShop() {
      try {
        const r = await fetch("/api/admin/settings");
        const d = await r.json();
        if (d?.shop?.name) setShopName(d.shop.name);
        setShopUpiId(String(d?.shop?.upiId || "").trim());
      } catch {
        /* ignore */
      }
    }
    loadShop();
  }, []);

  async function setStatus(id: string, status: string) {
    const res = await fetch("/api/admin/enquiries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data?.error?.message || "Status update failed");
      return;
    }
    setMsg(data?.message || `Status → ${status}`);
    load(q);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
          Customer enquiries
        </h1>
        <p className="mt-1 text-sm text-muted">
          Admin: PAID / Convert → then Billing creates invoice → status{" "}
          <strong>BILL SENT</strong> (WhatsApp to customer)
        </p>
      </div>

      <AdminSearchBar
        value={q}
        onChange={setQ}
        onSubmit={() => load(q)}
        placeholder="Search enquiry / phone / name…"
      />

      {msg && (
        <p className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
          {msg}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Enquiry</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enquiries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    No enquiries yet
                  </td>
                </tr>
              )}
              {enquiries.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setBillEnquiry(e)}
                      className="text-left font-semibold text-navy underline-offset-2 hover:underline"
                    >
                      {e.number}
                    </button>
                    <p className="text-xs text-muted">
                      {new Date(e.createdAt).toLocaleString()}
                    </p>
                    {e.order && (
                      <p className="text-xs font-semibold text-navy">
                        {e.order.number}
                      </p>
                    )}
                    {e.invoice && (
                      <p className="text-xs text-success">{e.invoice.number}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-navy">{e.customer.name}</p>
                    <p className="text-xs text-muted">
                      {e.customer.phone} · {e.customer.city}
                    </p>
                  </td>
                  <td className="px-4 py-3">{e.items.length}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-navy">
                      {formatInr(e.invoice?.grandTotal ?? e.estimatedAmount)}
                    </p>
                    {(e.loyaltyRedeem ?? 0) > 0 && (
                      <p className="text-xs text-success">
                        Redeemed −{formatInr(e.loyaltyRedeem ?? 0)}
                      </p>
                    )}
                    {e.invoice ? (
                      (e.loyaltyPointsForAmount ?? 0) > 0 ? (
                        <p className="text-xs font-semibold text-success">
                          +{e.loyaltyPointsForAmount} pts next bill
                        </p>
                      ) : null
                    ) : e.status === "PAID" &&
                      (e.loyaltyPointsForAmount ?? 0) > 0 ? (
                      <p className="text-xs font-semibold text-success">
                        +{e.loyaltyPointsForAmount} pts next bill
                      </p>
                    ) : e.status !== "PAID" &&
                      e.status !== "CONVERTED" &&
                      (e.loyaltyPointsIfPaid ?? 0) > 0 ? (
                      <p className="text-xs text-muted">
                        Mark PAID → +{e.loyaltyPointsIfPaid} pts
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={e.status}
                      onChange={(ev) => setStatus(e.id, ev.target.value)}
                      className={`rounded-lg border border-border px-2 py-1.5 text-xs font-bold ${statusSelectClass(
                        e.status
                      )}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s === "BILL_SENT" ? "BILL SENT" : s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      {e.invoice ? (
                        <button
                          type="button"
                          className="text-[#128C7E]"
                          onClick={() => {
                            const url = invoiceCustomerWa(
                              e,
                              shopName,
                              shopUpiId
                            );
                            if (url && url !== "#") {
                              window.open(
                                url,
                                "_blank",
                                "noopener,noreferrer"
                              );
                            }
                          }}
                        >
                          WA invoice
                          {e.order ? ` + ${e.order.number}` : ""}
                        </button>
                      ) : null}
                      {e.status !== "CONVERTED" && !e.order && !e.invoice && (
                        <button
                          type="button"
                          className="text-amber"
                          onClick={async () => {
                            const res = await fetch(
                              `/api/admin/enquiries/${e.id}/convert-order`,
                              { method: "POST" }
                            );
                            const data = await res.json();
                            if (res.ok) {
                              setMsg(
                                `Converted to ${data.order.number} — use Billing to create invoice WhatsApp`
                              );
                              load(q);
                            } else {
                              setMsg(data?.error?.message || "Convert failed");
                            }
                          }}
                        >
                          Convert
                        </button>
                      )}
                      {e.invoice ? (
                        <>
                          <Link
                            href={`/admin/invoices/${e.invoice.id}`}
                            className="text-navy"
                          >
                            Invoice
                          </Link>
                          <Link
                            href={`/admin/billing?enquiryId=${encodeURIComponent(e.id)}`}
                            className="text-amber"
                          >
                            Edit invoice
                          </Link>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setBillEnquiry(e)}
                            className="text-navy"
                          >
                            Preview
                          </button>
                          <Link
                            href={`/admin/billing?enquiryId=${encodeURIComponent(e.id)}`}
                            className="text-amber"
                          >
                            Create invoice
                          </Link>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {billEnquiry && (
        <EnquiryBillModal
          enquiry={billEnquiry}
          shopName={shopName}
          shopUpiId={shopUpiId}
          onClose={() => setBillEnquiry(null)}
        />
      )}
    </div>
  );
}

function EnquiryBillModal({
  enquiry,
  shopName,
  shopUpiId,
  onClose,
}: {
  enquiry: Enquiry;
  shopName: string;
  shopUpiId: string;
  onClose: () => void;
}) {
  const [upiId, setUpiId] = useState(shopUpiId);
  const [shopLabel, setShopLabel] = useState(shopName);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.shop?.name) setShopLabel(d.shop.name);
        setUpiId(String(d?.shop?.upiId || "").trim());
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setUpiId(shopUpiId);
    setShopLabel(shopName);
  }, [shopUpiId, shopName]);

  const itemsTotal = enquiry.items.reduce(
    (sum, it) => sum + it.unitPrice * it.quantity,
    0
  );
  const total = enquiry.estimatedAmount || itemsTotal;
  const hasInvoice = !!enquiry.invoice;

  const waUrl = useMemo(
    () => invoiceCustomerWa(enquiry, shopLabel, upiId),
    [enquiry, shopLabel, upiId]
  );

  function printBill() {
    window.print();
  }

  function sendWhatsApp() {
    if (!waUrl || waUrl === "#") return;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 print:static print:bg-transparent print:p-0">
      <div
        id="enquiry-bill-print"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl print:max-h-none print:max-w-none print:rounded-none print:shadow-none"
      >
        <div className="space-y-4 p-6 text-navy print:p-4 print:text-black">
          <div className="text-center">
            <p className="text-lg font-bold">{shopLabel}</p>
            <p className="text-sm text-muted print:text-black">
              {hasInvoice
                ? "Linked tax invoice"
                : "Enquiry preview — create invoice to WhatsApp customer"}
            </p>
            <p className="mt-1 font-semibold">{enquiry.number}</p>
            {enquiry.order && (
              <p className="text-sm font-semibold">{enquiry.order.number}</p>
            )}
            {enquiry.invoice && (
              <p className="text-sm text-success">{enquiry.invoice.number}</p>
            )}
            <p className="text-xs text-muted print:text-black">
              {new Date(enquiry.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="text-sm">
            <p>
              <span className="text-muted print:text-black">Customer:</span>{" "}
              {enquiry.customer.name || "—"}
            </p>
            <p>
              <span className="text-muted print:text-black">Phone:</span>{" "}
              {enquiry.customer.phone}
            </p>
            {enquiry.customer.city && (
              <p>
                <span className="text-muted print:text-black">Place:</span>{" "}
                {enquiry.customer.city}
              </p>
            )}
            {enquiry.customer.email && (
              <p>
                <span className="text-muted print:text-black">Email:</span>{" "}
                {enquiry.customer.email}
              </p>
            )}
            <p>
              <span className="text-muted print:text-black">Status:</span>{" "}
              {enquiry.status}
            </p>
            {upiId ? (
              <p>
                <span className="text-muted print:text-black">UPI:</span> {upiId}
              </p>
            ) : null}
          </div>

          <table className="w-full border-t border-b border-border text-sm print:border-black">
            <thead>
              <tr className="text-left text-xs uppercase text-muted print:text-black">
                <th className="py-2">#</th>
                <th className="py-2">Item</th>
                <th className="py-2">Qty</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">Amt</th>
              </tr>
            </thead>
            <tbody>
              {enquiry.items.map((it, idx) => (
                <tr key={it.id} className="border-t border-border/50">
                  <td className="py-1.5 align-top text-muted print:text-black">
                    {idx + 1}
                  </td>
                  <td className="py-1.5">
                    <p className="font-medium">{it.product.nameEn}</p>
                    <p className="text-xs text-muted print:text-black">
                      {it.product.code}
                      {it.product.category?.nameEn
                        ? ` · ${it.product.category.nameEn}`
                        : ""}
                    </p>
                  </td>
                  <td className="py-1.5 align-top">{it.quantity}</td>
                  <td className="py-1.5 align-top text-right">
                    {formatInr(it.unitPrice)}
                  </td>
                  <td className="py-1.5 align-top text-right font-semibold">
                    {formatInr(it.unitPrice * it.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-1 text-right text-sm">
            <p>
              Items: <strong>{enquiry.items.length}</strong>
            </p>
            {(enquiry.loyaltyRedeem ?? 0) > 0 && (
              <p className="text-success">
                Loyalty redeem: −{formatInr(enquiry.loyaltyRedeem ?? 0)}
              </p>
            )}
            <p className="text-lg font-bold">
              {hasInvoice ? "Invoice total" : "Cart total"}:{" "}
              {formatInr(enquiry.invoice?.grandTotal ?? total)}
            </p>
          </div>

          {enquiry.note && (
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted print:bg-transparent print:text-black">
              Note: {enquiry.note}
            </p>
          )}

          <p className="text-center text-xs text-muted print:text-black">
            Thank you · Sivakasi
          </p>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4 print:hidden">
            <button
              type="button"
              onClick={printBill}
              className="rounded-full bg-navy px-4 py-2.5 text-sm font-semibold text-white"
            >
              Print
            </button>
            {hasInvoice ? (
              <button
                type="button"
                onClick={sendWhatsApp}
                className="rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-2.5 text-sm font-semibold text-[#128C7E]"
              >
                WhatsApp invoice
                {enquiry.order ? ` + ${enquiry.order.number}` : ""}
              </button>
            ) : null}
            {hasInvoice && enquiry.invoice ? (
              <>
                <Link
                  href={`/admin/invoices/${enquiry.invoice.id}`}
                  className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-navy"
                >
                  Open invoice
                </Link>
                <Link
                  href={`/admin/billing?enquiryId=${encodeURIComponent(enquiry.id)}`}
                  className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-amber"
                >
                  Edit invoice
                </Link>
              </>
            ) : (
              <Link
                href={`/admin/billing?enquiryId=${encodeURIComponent(enquiry.id)}`}
                className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-amber"
              >
                Create tax invoice
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-muted"
            >
              Close
            </button>
          </div>
          {hasInvoice ? (
            <p className="text-xs text-success print:hidden">
              WhatsApp sends tax invoice + order
              {enquiry.order ? ` (${enquiry.order.number})` : ""}
              {upiId ? ` + UPI` : ""}. Edit in Billing keeps the same customer
              link.
            </p>
          ) : (
            <p className="text-xs text-amber print:hidden">
              No estimate WhatsApp — create a tax invoice in Billing, then send
              INV + order to the customer.
            </p>
          )}
        </div>
      </div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #enquiry-bill-print, #enquiry-bill-print * { visibility: visible !important; }
          #enquiry-bill-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: none !important;
            box-shadow: none !important;
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
}
