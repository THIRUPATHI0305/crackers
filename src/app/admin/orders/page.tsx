"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatInr } from "@/lib/admin-data";
import {
  AdminSearchBar,
  matchesQuery,
} from "@/components/admin/AdminSearchBar";

type Order = {
  id: string;
  number: string;
  status: string;
  amount: number;
  createdAt: string;
  eta: string | null;
  customer: { name: string | null; phone: string };
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/admin/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []));
  }, []);

  const filtered = useMemo(
    () =>
      orders.filter((o) =>
        matchesQuery(
          q,
          o.number,
          o.status,
          o.customer.name,
          o.customer.phone,
          o.amount
        )
      ),
    [orders, q]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
          Orders
        </h1>
        <p className="mt-1 text-sm text-muted">Live orders from database</p>
      </div>

      <AdminSearchBar
        value={q}
        onChange={setQ}
        placeholder="Search order / phone / name / status…"
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    {orders.length === 0
                      ? "No orders yet — convert an enquiry first"
                      : "No orders match your search"}
                  </td>
                </tr>
              )}
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-navy">{o.number}</p>
                    <p className="text-xs text-muted">
                      {new Date(o.createdAt).toLocaleString()}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-navy">{o.customer.name}</p>
                    <p className="text-xs text-muted">{o.customer.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-amber/15 px-2.5 py-1 text-xs font-bold text-amber">
                      {o.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {formatInr(o.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="font-semibold text-amber hover:underline"
                    >
                      Manage
                    </Link>
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
