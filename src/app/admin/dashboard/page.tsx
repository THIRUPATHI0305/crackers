"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MetricCard } from "@/components/admin/MetricCard";
import { formatInr } from "@/lib/admin-data";

type Dash = {
  metrics: {
    todaySales: number;
    todayInvoices: number;
    newEnquiries: number;
    pendingPacking: number;
    shipped: number;
    delivered: number;
    loyaltyIssued: number;
  };
  lowStock: { name: string; code: string; stock: number; min: number }[];
  topSelling: { name: string; sold: number; revenue: number }[];
  recentInvoices: {
    number: string;
    customerName: string | null;
    paymentMethod: string;
    grandTotal: number;
  }[];
  recentEnquiries: {
    number: string;
    status: string;
    estimatedAmount: number;
    customer: { name: string | null; city: string | null };
  }[];
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message || "Failed");
        setData(j);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <p className="rounded-xl bg-danger/10 p-4 text-danger">
        {error}. <Link href="/admin/login">Login again</Link>
      </p>
    );
  }

  if (!data) {
    return <p className="text-muted">Loading dashboard…</p>;
  }

  const m = data.metrics;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-amber">
            Overview
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
            Dashboard
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/billing"
            className="rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-white"
          >
            Open billing
          </Link>
          <Link
            href="/admin/enquiries"
            className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-navy"
          >
            New enquiries ({m.newEnquiries})
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Today's sales"
          value={formatInr(m.todaySales)}
          tone="amber"
        />
        <MetricCard label="Today's invoices" value={String(m.todayInvoices)} />
        <MetricCard
          label="New enquiries"
          value={String(m.newEnquiries)}
          tone="danger"
        />
        <MetricCard label="Pending packing" value={String(m.pendingPacking)} />
        <MetricCard label="Shipped / out" value={String(m.shipped)} />
        <MetricCard
          label="Delivered"
          value={String(m.delivered)}
          tone="success"
        />
        <MetricCard
          label="Loyalty points issued today"
          value={String(m.loyaltyIssued)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-navy">Low-stock products</h2>
            <Link href="/admin/stock" className="text-sm font-semibold text-amber">
              Manage
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {data.lowStock.length === 0 && (
              <li className="py-3 text-sm text-muted">No low stock items</li>
            )}
            {data.lowStock.map((item) => (
              <li
                key={item.code}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-navy">{item.name}</p>
                  <p className="text-xs text-muted">{item.code}</p>
                </div>
                <span className="rounded-full bg-danger/10 px-2.5 py-1 text-xs font-bold text-danger">
                  {item.stock} / min {item.min}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="font-bold text-navy">Top-selling products</h2>
          <ul className="mt-4 divide-y divide-border">
            {data.topSelling.length === 0 && (
              <li className="py-3 text-sm text-muted">No sales yet</li>
            )}
            {data.topSelling.map((item) => (
              <li
                key={item.name}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-navy">{item.name}</p>
                  <p className="text-xs text-muted">{item.sold} units sold</p>
                </div>
                <span className="font-bold text-navy">
                  {formatInr(item.revenue)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-navy">Recent invoices</h2>
            <Link
              href="/admin/invoices"
              className="text-sm font-semibold text-amber"
            >
              View all
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {data.recentInvoices.map((inv) => (
              <li
                key={inv.number}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-navy">{inv.number}</p>
                  <p className="text-xs text-muted">
                    {inv.customerName || "Walk-in"} · {inv.paymentMethod}
                  </p>
                </div>
                <span className="font-bold text-navy">
                  {formatInr(inv.grandTotal)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-navy">Latest enquiries</h2>
            <Link
              href="/admin/enquiries"
              className="text-sm font-semibold text-amber"
            >
              Open queue
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {data.recentEnquiries.map((e) => (
              <li
                key={e.number}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-navy">{e.number}</p>
                  <p className="text-xs text-muted">
                    {e.customer.name} · {e.customer.city}
                  </p>
                </div>
                <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold">
                  {e.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
