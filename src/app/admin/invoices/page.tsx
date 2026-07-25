"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatInr } from "@/lib/admin-data";
import { AdminSearchBar } from "@/components/admin/AdminSearchBar";

type Invoice = {
  id: string;
  number: string;
  publicToken: string;
  customerName: string | null;
  customerPhone: string | null;
  paymentMethod: string;
  grandTotal: number;
  createdAt: string;
  order: { id: string; number: string } | null;
  enquiry: { id: string; number: string } | null;
};

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [q, setQ] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load(search = "") {
    const res = await fetch(
      `/api/admin/invoices${search ? `?q=${encodeURIComponent(search)}` : ""}`
    );
    const data = await res.json();
    if (res.ok) setInvoices(data.invoices || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteInvoice(inv: Invoice) {
    const parts = [
      inv.number,
      inv.order ? `order ${inv.order.number}` : null,
      inv.enquiry ? `enquiry ${inv.enquiry.number}` : null,
      "loyalty for this bill",
    ].filter(Boolean);
    if (
      !confirm(
        `Delete ${parts.join(" + ")}?\n\nStock will be restored. This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingId(inv.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/invoices/${inv.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message || "Could not delete invoice");
        return;
      }
      setInvoices((prev) => prev.filter((x) => x.id !== inv.id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
          Invoice history
        </h1>
        <p className="mt-1 text-sm text-muted">Live invoices · public token links</p>
      </div>

      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}

      <AdminSearchBar
        value={q}
        onChange={setQ}
        onSubmit={() => load(q)}
        placeholder="Invoice / phone / name…"
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Invoice</th>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    No invoices yet — create one in Billing
                  </td>
                </tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-navy">{inv.number}</p>
                    <p className="text-xs text-muted">
                      {new Date(inv.createdAt).toLocaleString()}
                    </p>
                    {inv.enquiry && (
                      <p className="text-xs text-muted">{inv.enquiry.number}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-navy">
                    {inv.order?.number || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-navy">
                      {inv.customerName || "Walk-in"}
                    </p>
                    <p className="text-xs text-muted">{inv.customerPhone}</p>
                  </td>
                  <td className="px-4 py-3">{inv.paymentMethod}</td>
                  <td className="px-4 py-3 font-bold">
                    {formatInr(inv.grandTotal)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <Link
                        href={`/admin/invoices/${inv.id}`}
                        className="text-amber"
                      >
                        View / WhatsApp
                      </Link>
                      <Link
                        href={`/invoice/${inv.publicToken}`}
                        className="text-navy"
                      >
                        Public link
                      </Link>
                      <button
                        type="button"
                        disabled={deletingId === inv.id}
                        onClick={() => deleteInvoice(inv)}
                        className="text-danger disabled:opacity-50"
                      >
                        {deletingId === inv.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
