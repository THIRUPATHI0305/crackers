"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInr } from "@/lib/admin-data";
import { billPrintCss } from "@/lib/bill-print";

type Invoice = {
  id: string;
  number: string;
  publicToken: string;
  customerName: string | null;
  customerPhone: string | null;
  customerPhoneMasked: string | null;
  paymentMethod: string;
  subtotal: number;
  billDiscount: number;
  loyaltyRedeem: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  createdAt: string;
  payOpen?: boolean;
  order: { id: string; number: string } | null;
  enquiry: { id: string; number: string } | null;
  items: {
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  cashier: { email: string; username: string | null };
};

export default function AdminInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [printMode, setPrintMode] = useState<"a4" | "thermal" | null>(null);

  useEffect(() => {
    fetch(`/api/admin/invoices/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.invoice) {
          setInvoice(data.invoice);
          setWhatsappUrl(data.whatsappUrl || null);
        } else setError(data?.error?.message || "Not found");
      });
  }, [id]);

  if (error) {
    return (
      <div className="space-y-3">
        <Link href="/admin/invoices" className="text-sm font-semibold text-muted">
          ← Invoice history
        </Link>
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  if (!invoice) {
    return <p className="text-sm text-muted">Loading invoice…</p>;
  }

  function sendWhatsApp() {
    if (!whatsappUrl || whatsappUrl === "#") return;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  function printReceipt(mode: "a4" | "thermal") {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintMode(null), 400);
    }, 100);
  }

  async function deleteInvoice() {
    if (!invoice) return;
    const parts = [
      invoice.number,
      invoice.order ? `order ${invoice.order.number}` : null,
      invoice.enquiry ? `enquiry ${invoice.enquiry.number}` : null,
      "loyalty for this bill",
    ].filter(Boolean);
    if (
      !confirm(
        `Delete ${parts.join(" + ")}?\n\nStock will be restored. This cannot be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data?.error?.message || "Could not delete invoice");
        return;
      }
      router.push("/admin/invoices");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function setPaymentStatus(action: "mark_paid" | "reopen_pay") {
    if (!invoice) return;
    if (
      action === "mark_paid" &&
      !confirm(
        `Mark ${invoice.number} as payment received?\n\nThis closes the customer pay link.`
      )
    ) {
      return;
    }
    if (
      action === "reopen_pay" &&
      !confirm(
        `Reopen pay link for ${invoice.number}?\n\nBalance will show as unpaid again.`
      )
    ) {
      return;
    }
    setPaymentBusy(true);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          paymentMethod:
            action === "mark_paid"
              ? invoice.paymentMethod === "CASH" ||
                invoice.paymentMethod === "CARD"
                ? invoice.paymentMethod
                : "UPI"
              : undefined,
          awardPoints: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data?.error?.message || "Could not update payment");
        return;
      }
      if (data.invoice) setInvoice(data.invoice);
    } finally {
      setPaymentBusy(false);
    }
  }

  const payOpen =
    invoice.payOpen ??
    (invoice.balanceAmount > 0.009 &&
      invoice.paidAmount + 0.009 < invoice.grandTotal);

  return (
    <div className="mx-auto max-w-3xl space-y-6 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link
            href="/admin/invoices"
            className="text-sm font-semibold text-muted"
          >
            ← Invoice history
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
            {invoice.number}
          </h1>
          {(invoice.order || invoice.enquiry) && (
            <p className="mt-1 text-sm text-muted">
              {invoice.order ? `Order ${invoice.order.number}` : null}
              {invoice.order && invoice.enquiry ? " · " : null}
              {invoice.enquiry ? `Enquiry ${invoice.enquiry.number}` : null}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => printReceipt("a4")}
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-navy"
          >
            Print A4
          </button>
          <button
            type="button"
            onClick={() => printReceipt("thermal")}
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-navy"
          >
            Thermal 55mm
          </button>
          <button
            type="button"
            onClick={sendWhatsApp}
            disabled={!whatsappUrl}
            className="rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-2 text-sm font-semibold text-[#128C7E] disabled:opacity-40"
          >
            WhatsApp customer
          </button>
          <Link
            href={`/invoice/${invoice.publicToken}`}
            className="rounded-full bg-amber px-4 py-2 text-sm font-semibold text-white"
          >
            Online link
          </Link>
          {payOpen ? (
            <button
              type="button"
              onClick={() => setPaymentStatus("mark_paid")}
              disabled={paymentBusy}
              className="rounded-full border border-success/40 bg-success/15 px-4 py-2 text-sm font-semibold text-success disabled:opacity-50"
            >
              {paymentBusy ? "Saving…" : "Payment received"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPaymentStatus("reopen_pay")}
              disabled={paymentBusy}
              className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-navy disabled:opacity-50"
            >
              {paymentBusy ? "Saving…" : "Reopen pay link"}
            </button>
          )}
          <button
            type="button"
            onClick={deleteInvoice}
            disabled={deleting}
            className="rounded-full border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {actionError ? (
        <p className="text-sm font-semibold text-danger print:hidden">
          {actionError}
        </p>
      ) : null}

      <div
        id="invoice-print-root"
        className={`rounded-2xl border border-border bg-surface p-6 shadow-sm print:border-0 print:shadow-none ${
          printMode === "thermal"
            ? "receipt-thermal-55 font-mono"
            : printMode === "a4"
              ? "receipt-a4"
              : ""
        }`}
      >
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-muted print:text-black">
              Customer
            </p>
            <p className="receipt-title mt-1 font-bold text-navy print:text-black">
              {invoice.customerName || "Walk-in"}
            </p>
            <p className="text-sm text-muted print:text-black">
              {invoice.customerPhoneMasked || "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-muted print:text-black">
              Invoice
            </p>
            <p className="mt-1 font-bold text-navy print:text-black">
              {invoice.number}
            </p>
            <p className="text-sm text-muted print:text-black">
              {new Date(invoice.createdAt).toLocaleString()}
            </p>
            {invoice.order && (
              <p className="text-sm font-semibold text-navy print:text-black">
                {invoice.order.number}
              </p>
            )}
          </div>
        </div>

        <table className="mt-6 w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted print:border-black print:text-black">
            <tr>
              <th className="py-2">Item</th>
              <th className="py-2">Qty</th>
              <th className="py-2">Rate</th>
              <th className="py-2 text-right">Amt</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it) => (
              <tr key={it.id} className="border-b border-border/60 print:border-black/30">
                <td className="max-w-[28mm] break-words py-2 font-medium text-navy print:text-black">
                  {it.name}
                </td>
                <td className="py-2 print:text-black">{it.quantity}</td>
                <td className="py-2 print:text-black">
                  {formatInr(it.unitPrice)}
                </td>
                <td className="py-2 text-right font-semibold print:text-black">
                  {formatInr(it.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted print:text-black">Subtotal</span>
            <span className="print:text-black">{formatInr(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted print:text-black">Discount</span>
            <span className="print:text-black">
              {formatInr(invoice.billDiscount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted print:text-black">Loyalty</span>
            <span className="print:text-black">
              {formatInr(invoice.loyaltyRedeem)}
            </span>
          </div>
          <div className="receipt-total flex justify-between text-base font-bold text-navy print:text-black">
            <span>Grand total</span>
            <span>{formatInr(invoice.grandTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted print:text-black">
              Paid ({invoice.paymentMethod})
            </span>
            <span className="print:text-black">
              {formatInr(invoice.paidAmount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted print:text-black">Balance</span>
            <span className="print:text-black">
              {formatInr(invoice.balanceAmount)}
            </span>
          </div>
          <p className="pt-2 text-xs font-semibold print:hidden">
            {payOpen ? (
              <span className="text-amber">Pay link open — waiting for payment</span>
            ) : (
              <span className="text-success">Pay link closed — payment received</span>
            )}
          </p>
          <p className="pt-3 text-xs text-muted print:text-black">
            Cashier: {invoice.cashier.username || invoice.cashier.email}
          </p>
        </div>
      </div>

      <style>
        {billPrintCss({ rootId: "invoice-print-root", mode: printMode })}
      </style>
    </div>
  );
}
