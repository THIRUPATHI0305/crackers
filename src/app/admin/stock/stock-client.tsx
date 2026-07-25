"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInr } from "@/lib/admin-data";
import {
  AdminSearchBar,
  matchesQuery,
} from "@/components/admin/AdminSearchBar";

type Product = {
  id: string;
  nameEn: string;
  code: string;
  stock: number;
  minStock: number;
  offerPrice: number;
};

function StockRow({
  product,
  onAdjusted,
}: {
  product: Product;
  onAdjusted: (message: string, success: boolean) => void;
}) {
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  async function adjust(delta: number) {
    if (!delta || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          delta,
          note:
            delta > 0
              ? `Manual add +${delta}`
              : `Manual reduce ${delta}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onAdjusted(`Updated ${product.code} → ${data.product.stock}`, true);
      } else {
        onAdjusted(data?.error?.message || "Failed", false);
      }
    } catch {
      onAdjusted("Network error", false);
    }
    setBusy(false);
  }

  const amount = Math.max(1, Math.floor(Number(qty) || 1));

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3">
        <p className="font-semibold text-navy">{product.nameEn}</p>
        <p className="text-xs text-muted">{product.code}</p>
        {product.stock <= product.minStock && (
          <p className="mt-0.5 text-xs font-semibold text-danger">
            Below min ({product.minStock})
          </p>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`text-lg font-bold tabular-nums ${
            product.stock <= product.minStock ? "text-danger" : "text-navy"
          }`}
        >
          {product.stock}
        </span>
      </td>
      <td className="px-4 py-3">{formatInr(product.offerPrice)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center overflow-hidden rounded-xl border border-border bg-surface">
            <button
              type="button"
              aria-label={`Remove ${amount} from stock`}
              disabled={busy || product.stock <= 0}
              onClick={() => adjust(-Math.min(amount, product.stock))}
              className="flex h-9 w-9 items-center justify-center text-base font-bold text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={100000}
              value={qty}
              onChange={(e) => {
                const n = Number(e.target.value);
                setQty(Number.isFinite(n) && n > 0 ? Math.floor(n) : 1);
              }}
              className="h-9 w-14 border-x border-border bg-surface-muted text-center text-sm font-bold tabular-nums text-navy outline-none"
              title="Custom count"
            />
            <button
              type="button"
              aria-label={`Add ${amount} to stock`}
              disabled={busy}
              onClick={() => adjust(amount)}
              className="flex h-9 w-9 items-center justify-center text-base font-bold text-success transition hover:bg-success/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
          </div>
          <span className="text-xs text-muted">±{amount} custom</span>
        </div>
      </td>
    </tr>
  );
}

export function AdminStockClient({
  initialProducts,
}: {
  initialProducts: Product[];
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const lowStock = useMemo(
    () => products.filter((p) => p.stock <= p.minStock),
    [products]
  );

  const filtered = useMemo(
    () => products.filter((p) => matchesQuery(q, p.nameEn, p.code)),
    [products, q]
  );

  function handleAdjusted(message: string, success: boolean) {
    setOk(success);
    setMsg(message);
    if (success) router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
            Stock management
          </h1>
          <p className="mt-1 text-sm text-muted">
            Set a custom count, then use − / + to adjust stock ·{" "}
            {products.length} products
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-navy"
        >
          Refresh
        </button>
      </div>

      <AdminSearchBar
        value={q}
        onChange={setQ}
        placeholder="Search product name / code…"
      />

      {msg && (
        <p
          className={`rounded-xl px-3 py-2 text-sm ${
            ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
          }`}
        >
          {msg}
        </p>
      )}

      <section className="rounded-2xl border border-danger/20 bg-danger/5 p-5">
        <h2 className="font-bold text-danger">Low-stock alerts</h2>
        <ul className="mt-3 space-y-2">
          {lowStock.length === 0 && (
            <li className="text-sm text-muted">No low stock</li>
          )}
          {lowStock.map((item) => (
            <li
              key={item.code}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-4 py-3 text-sm"
            >
              <span className="font-semibold text-navy">
                {item.nameEn}{" "}
                <span className="font-normal text-muted">({item.code})</span>
              </span>
              <span className="font-bold text-danger">
                {item.stock} left · min {item.minStock}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Stock</th>
                <th className="px-4 py-3 font-semibold">Unit price</th>
                <th className="px-4 py-3 font-semibold">
                  Adjust (− / count / +)
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <StockRow
                  key={`${p.id}-${p.stock}`}
                  product={p}
                  onAdjusted={handleAdjusted}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    {products.length === 0
                      ? "No products found"
                      : "No products match your search"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
