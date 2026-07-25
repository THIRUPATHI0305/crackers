"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatInr } from "@/lib/admin-data";
import {
  AdminSearchBar,
  matchesQuery,
} from "@/components/admin/AdminSearchBar";

export type AdminProductRow = {
  id: string;
  nameEn: string;
  code: string;
  offerPrice: number;
  originalPrice: number;
  stock: number;
  category: { nameEn: string } | null;
  brand: { nameEn: string } | null;
};

export function AdminProductsClient({
  products,
}: {
  products: AdminProductRow[];
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      products.filter((p) =>
        matchesQuery(
          q,
          p.nameEn,
          p.code,
          p.category?.nameEn,
          p.brand?.nameEn
        )
      ),
    [products, q]
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, AdminProductRow[]>();
    for (const p of filtered) {
      const key = p.category?.nameEn || "Uncategorised";
      const list = map.get(key) || [];
      list.push(p);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
            Products
          </h1>
          <p className="mt-1 text-sm text-muted">
            Live catalogue from PostgreSQL · {products.length} products
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-white"
        >
          Add product
        </Link>
      </div>

      <AdminSearchBar
        value={q}
        onChange={setQ}
        placeholder="Search name / code / category / brand…"
      />

      {products.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="font-semibold text-navy">No products in database</p>
          <p className="mt-1 text-sm text-muted">
            Add a product, or check Billing product search.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {byCategory.map(([category, items]) => (
            <section
              key={category}
              className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
            >
              <div className="flex items-center justify-between bg-navy px-4 py-3 text-white">
                <h2 className="text-sm font-bold uppercase tracking-wide">
                  {category}
                </h2>
                <span className="text-xs font-semibold text-amber-bright">
                  {items.length} item{items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Product</th>
                      <th className="px-4 py-3 font-semibold">Code</th>
                      <th className="px-4 py-3 font-semibold">Brand</th>
                      <th className="px-4 py-3 font-semibold">Price</th>
                      <th className="px-4 py-3 font-semibold">Stock</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-4 py-3 font-semibold text-navy">
                          {p.nameEn}
                        </td>
                        <td className="px-4 py-3 text-muted">{p.code}</td>
                        <td className="px-4 py-3">{p.brand?.nameEn || "—"}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold">
                            {formatInr(p.offerPrice)}
                          </p>
                          <p className="text-xs text-muted line-through">
                            {formatInr(p.originalPrice)}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-semibold">{p.stock}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/products/${p.id}/edit`}
                            className="font-semibold text-amber hover:underline"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">
              No products match your search
            </p>
          )}
        </div>
      )}
    </div>
  );
}
