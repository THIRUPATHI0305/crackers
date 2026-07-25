"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "@/components/admin/MetricCard";
import { formatInr } from "@/lib/admin-data";

type Totals = {
  total: number;
  cash: number;
  upi: number;
  card: number;
  discount: number;
  loyaltyRedeemed: number;
  invoiceCount: number;
  cancelled: number;
  qtySold: number;
};

type TopItem = { name: string; sold: number; revenue: number };

function todayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export default function DailySalesReportPage() {
  const [date, setDate] = useState(todayStr());
  const [totals, setTotals] = useState<Totals | null>(null);
  const [topSelling, setTopSelling] = useState<TopItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function load(d: string) {
    setLoading(true);
    const res = await fetch(`/api/admin/reports/daily?date=${d}`);
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setTotals(data.totals);
      setTopSelling(data.topSelling || []);
      setDate(data.date || d);
    }
  }

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!totals) {
    return <p className="text-sm text-muted">Loading report…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
            Daily sales report
          </h1>
          <p className="mt-1 text-sm text-muted">
            Live totals from invoices · {date}
            {loading ? " · refreshing…" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => load(todayStr())}
            className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => load(todayStr(-1))}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted"
          >
            Yesterday
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => load(e.target.value)}
            className="rounded-full border border-border px-4 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total sales"
          value={formatInr(totals.total)}
          tone="amber"
        />
        <MetricCard label="Cash" value={formatInr(totals.cash)} />
        <MetricCard label="UPI" value={formatInr(totals.upi)} tone="success" />
        <MetricCard label="Card" value={formatInr(totals.card)} />
        <MetricCard
          label="Discount amount"
          value={formatInr(totals.discount)}
        />
        <MetricCard
          label="Loyalty redeemed"
          value={formatInr(totals.loyaltyRedeemed)}
        />
        <MetricCard
          label="Invoice count"
          value={String(totals.invoiceCount)}
        />
        <MetricCard
          label="Cancelled invoices"
          value={String(totals.cancelled)}
          tone="danger"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="font-bold text-navy">Product quantity sold</h2>
          <p className="mt-4 font-[family-name:var(--font-display)] text-4xl font-semibold text-navy">
            {totals.qtySold}
          </p>
          <p className="mt-1 text-sm text-muted">units across all categories</p>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="font-bold text-navy">Top-selling products</h2>
          <ul className="mt-4 divide-y divide-border">
            {topSelling.length === 0 && (
              <li className="py-3 text-sm text-muted">No sales this day</li>
            )}
            {topSelling.map((item) => (
              <li
                key={item.name}
                className="flex items-center justify-between py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-navy">{item.name}</p>
                  <p className="text-xs text-muted">{item.sold} sold</p>
                </div>
                <span className="font-bold">{formatInr(item.revenue)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
