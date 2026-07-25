"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInr } from "@/lib/admin-data";

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
            onClick={() => window.print()}
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-navy"
          >
            Print
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

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-muted">Customer</p>
            <p className="mt-1 font-bold text-navy">
              {invoice.customerName || "Walk-in"}
            </p>
            <p className="text-sm text-muted">
              {invoice.customerPhoneMasked || "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-muted">Invoice</p>
            <p className="mt-1 font-bold text-navy">{invoice.number}</p>
            <p className="text-sm text-muted">
              {new Date(invoice.createdAt).toLocaleString()}
            </p>
            {invoice.order && (
              <p className="text-sm font-semibold text-navy">
                {invoice.order.number}
              </p>
            )}
          </div>
        </div>

        <table className="mt-6 w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="py-2">Item</th>
              <th className="py-2">Qty</th>
              <th className="py-2">Rate</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it) => (
              <tr key={it.id} className="border-b border-border/60">
                <td className="py-2 font-medium text-navy">{it.name}</td>
                <td className="py-2">{it.quantity}</td>
                <td className="py-2">{formatInr(it.unitPrice)}</td>
                <td className="py-2 text-right font-semibold">
                  {formatInr(it.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Subtotal</span>
            <span>{formatInr(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Discount</span>
            <span>{formatInr(invoice.billDiscount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Loyalty</span>
            <span>{formatInr(invoice.loyaltyRedeem)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-navy">
            <span>Grand total</span>
            <span>{formatInr(invoice.grandTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Paid ({invoice.paymentMethod})</span>
            <span>{formatInr(invoice.paidAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Balance</span>
            <span>{formatInr(invoice.balanceAmount)}</span>
          </div>
          <p className="pt-3 text-xs text-muted">
            Cashier: {invoice.cashier.username || invoice.cashier.email}
          </p>
        </div>
      </div>
    </div>
  );
}
