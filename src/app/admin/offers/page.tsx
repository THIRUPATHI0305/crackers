"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AdminSearchBar,
  matchesQuery,
} from "@/components/admin/AdminSearchBar";

type Category = { id: string; nameEn: string; slug: string };
type ProductOpt = {
  id: string;
  nameEn: string;
  code: string;
  category?: { nameEn: string; slug: string } | null;
};

type Offer = {
  id: string;
  title: string;
  subtitle: string | null;
  type: string;
  discountLabel: string | null;
  percentOff: number | null;
  fixedOff: number | null;
  categoryIds?: string[];
  productIds?: string[];
  categories?: Category[];
  products?: ProductOpt[];
  startAt: string;
  endAt: string;
  isActive: boolean;
};

const blank = {
  title: "",
  subtitle: "",
  type: "FESTIVAL",
  discountLabel: "",
  percentOff: "",
  fixedOff: "",
  categoryIds: [] as string[],
  productIds: [] as string[],
  startAt: "",
  endAt: "",
  isActive: true,
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatApiError(data: {
  error?: { message?: string; fields?: Record<string, string[]> };
}) {
  const fields = data?.error?.fields;
  if (fields && typeof fields === "object") {
    const parts = Object.entries(fields).flatMap(([k, v]) =>
      (Array.isArray(v) ? v : [String(v)]).map((m) => `${k}: ${m}`)
    );
    if (parts.length) return parts.join(" · ");
  }
  return data?.error?.message || "Request failed";
}

export default function AdminOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [productQ, setProductQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  async function load() {
    setError("");
    try {
      const [offRes, catRes, prodRes] = await Promise.all([
        fetch("/api/admin/offers"),
        fetch("/api/admin/categories"),
        fetch("/api/products?pageSize=500&inStock=false"),
      ]);
      const offData = await offRes.json();
      const catData = await catRes.json();
      const prodData = await prodRes.json();
      if (!offRes.ok) {
        setError(formatApiError(offData));
        setOffers([]);
        return;
      }
      setOffers(offData.offers || []);
      if (catRes.ok) setCategories(catData.categories || []);
      if (prodRes.ok) {
        setProducts(
          (prodData.products || []).map(
            (p: {
              id: string;
              nameEn: string;
              code: string;
              category?: { nameEn: string; slug: string };
            }) => ({
              id: p.id,
              nameEn: p.nameEn,
              code: p.code,
              category: p.category || null,
            })
          )
        );
      }
    } catch {
      setError("Failed to load offers");
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startCreate() {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    setEditing(null);
    setForm({
      ...blank,
      startAt: toLocalInput(now.toISOString()),
      endAt: toLocalInput(end.toISOString()),
      categoryIds: [],
      productIds: [],
    });
    setProductQ("");
    setOpen(true);
    setError("");
  }

  function startEdit(o: Offer) {
    setEditing(o.id);
    setForm({
      title: o.title,
      subtitle: o.subtitle || "",
      type: o.type,
      discountLabel: o.discountLabel || "",
      percentOff: o.percentOff != null ? String(o.percentOff) : "",
      fixedOff: o.fixedOff != null ? String(o.fixedOff) : "",
      categoryIds: o.categoryIds || [],
      productIds: o.productIds || [],
      startAt: toLocalInput(o.startAt),
      endAt: toLocalInput(o.endAt),
      isActive: o.isActive,
    });
    setProductQ("");
    setOpen(true);
    setError("");
  }

  function toggleCategory(id: string) {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter((x) => x !== id)
        : [...f.categoryIds, id],
    }));
  }

  function toggleProduct(id: string) {
    setForm((f) => ({
      ...f,
      productIds: f.productIds.includes(id)
        ? f.productIds.filter((x) => x !== id)
        : [...f.productIds, id],
    }));
  }

  const filteredProducts = useMemo(() => {
    const needle = productQ.trim().toLowerCase();
    if (!needle) return products.slice(0, 80);
    return products
      .filter(
        (p) =>
          p.nameEn.toLowerCase().includes(needle) ||
          p.code.toLowerCase().includes(needle) ||
          (p.category?.nameEn || "").toLowerCase().includes(needle)
      )
      .slice(0, 80);
  }, [products, productQ]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const start = new Date(form.startAt);
      const end = new Date(form.endAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        setError("Invalid start or end date");
        setLoading(false);
        return;
      }
      if (form.type === "CATEGORY" && form.categoryIds.length === 0) {
        setError("Select at least one category for CATEGORY offers");
        setLoading(false);
        return;
      }
      if (form.type === "COMBO" && form.productIds.length < 2) {
        setError("Select at least 2 products for a COMBO offer");
        setLoading(false);
        return;
      }
      const payload = {
        id: editing || undefined,
        title: form.title,
        subtitle: form.subtitle || undefined,
        type: form.type,
        discountLabel: form.discountLabel || undefined,
        percentOff: form.percentOff ? Number(form.percentOff) : null,
        fixedOff: form.fixedOff ? Number(form.fixedOff) : null,
        categoryIds: form.type === "CATEGORY" ? form.categoryIds : [],
        productIds: form.type === "COMBO" ? form.productIds : [],
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        isActive: form.isActive,
      };
      const res = await fetch("/api/admin/offers", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(formatApiError(data));
        setLoading(false);
        return;
      }
      setMsg(editing ? "Offer updated" : "Offer created");
      setOpen(false);
      await load();
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  async function toggle(o: Offer) {
    const res = await fetch("/api/admin/offers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: o.id,
        title: o.title,
        subtitle: o.subtitle || undefined,
        type: o.type,
        discountLabel: o.discountLabel || undefined,
        percentOff: o.percentOff,
        fixedOff: o.fixedOff,
        categoryIds: o.categoryIds || [],
        productIds: o.productIds || [],
        startAt: o.startAt,
        endAt: o.endAt,
        isActive: !o.isActive,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(o.isActive ? "Offer deactivated" : "Offer activated");
      load();
    } else {
      setError(formatApiError(data));
    }
  }

  const filtered = useMemo(
    () =>
      offers.filter((o) =>
        matchesQuery(
          q,
          o.title,
          o.subtitle,
          o.type,
          o.discountLabel,
          ...(o.categories || []).map((c) => c.nameEn),
          ...(o.products || []).map((p) => p.nameEn)
        )
      ),
    [offers, q]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
            Offers
          </h1>
          <p className="mt-1 text-sm text-muted">
            CATEGORY → pick categories · COMBO → pick 2+ products
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-white"
        >
          Create offer
        </button>
      </div>

      <AdminSearchBar
        value={q}
        onChange={setQ}
        placeholder="Search offer title / type / category / product…"
      />

      {msg && (
        <p className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
          {msg}
        </p>
      )}
      {error && !open && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {open && (
        <form
          onSubmit={save}
          className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-sm"
        >
          <h2 className="font-bold text-navy">
            {editing ? "Edit offer" : "New offer"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm sm:col-span-2"
            />
            <input
              placeholder="Subtitle"
              value={form.subtitle}
              onChange={(e) =>
                setForm((f) => ({ ...f, subtitle: e.target.value }))
              }
              className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm sm:col-span-2"
            />
            <select
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value,
                  categoryIds:
                    e.target.value === "CATEGORY" ? f.categoryIds : [],
                  productIds: e.target.value === "COMBO" ? f.productIds : [],
                }))
              }
              className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm"
            >
              {["FESTIVAL", "COMBO", "PERCENT", "CATEGORY", "FLAT"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              placeholder="Discount label (e.g. 25% OFF)"
              value={form.discountLabel}
              onChange={(e) =>
                setForm((f) => ({ ...f, discountLabel: e.target.value }))
              }
              className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm"
            />
            <input
              type="number"
              placeholder="% off"
              value={form.percentOff}
              onChange={(e) =>
                setForm((f) => ({ ...f, percentOff: e.target.value }))
              }
              className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm"
            />
            <input
              type="number"
              placeholder="Fixed off ₹"
              value={form.fixedOff}
              onChange={(e) =>
                setForm((f) => ({ ...f, fixedOff: e.target.value }))
              }
              className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm"
            />
            <input
              required
              type="datetime-local"
              value={form.startAt}
              onChange={(e) =>
                setForm((f) => ({ ...f, startAt: e.target.value }))
              }
              className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm"
            />
            <input
              required
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
              className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm"
            />
          </div>

          {form.type === "CATEGORY" && (
            <div className="rounded-xl border border-border bg-surface-muted/50 p-4">
              <p className="text-sm font-bold text-navy">
                Apply to categories{" "}
                <span className="font-normal text-danger">*</span>
              </p>
              {categories.length === 0 ? (
                <p className="mt-3 text-sm text-amber">
                  No categories found — create some under Admin → Categories
                  first.
                </p>
              ) : (
                <div className="mt-3 grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
                  {categories.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-navy"
                    >
                      <input
                        type="checkbox"
                        checked={form.categoryIds.includes(c.id)}
                        onChange={() => toggleCategory(c.id)}
                        className="accent-amber"
                      />
                      {c.nameEn}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {form.type === "COMBO" && (
            <div className="rounded-xl border border-border bg-surface-muted/50 p-4">
              <p className="text-sm font-bold text-navy">
                Combo products{" "}
                <span className="font-normal text-danger">*</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                Pick at least 2 products. Discount applies when all selected
                products are on the bill.
              </p>
              <p className="mt-2 text-xs font-semibold text-navy">
                Selected: {form.productIds.length}
              </p>
              <input
                value={productQ}
                onChange={(e) => setProductQ(e.target.value)}
                placeholder="Search product name / code / category…"
                className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
              />
              {products.length === 0 ? (
                <p className="mt-3 text-sm text-amber">
                  No products found in catalogue.
                </p>
              ) : (
                <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
                  {filteredProducts.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-navy"
                    >
                      <input
                        type="checkbox"
                        checked={form.productIds.includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        className="mt-0.5 accent-amber"
                      />
                      <span>
                        <span className="font-semibold">{p.nameEn}</span>
                        <span className="block text-xs text-muted">
                          {p.code}
                          {p.category?.nameEn
                            ? ` · ${p.category.nameEn}`
                            : ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm font-semibold text-navy">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((f) => ({ ...f, isActive: e.target.checked }))
              }
              className="accent-amber"
            />
            Active
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-amber px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((o) => (
          <article
            key={o.id}
            className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              {o.discountLabel && (
                <span className="rounded-md bg-danger px-2 py-0.5 text-xs font-bold text-white">
                  {o.discountLabel}
                </span>
              )}
              <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-semibold text-muted">
                {o.type}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                  o.isActive
                    ? "bg-success/15 text-success"
                    : "bg-danger/10 text-danger"
                }`}
              >
                {o.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <h2 className="mt-4 text-xl font-bold text-navy">{o.title}</h2>
            <p className="mt-1 text-sm text-muted">{o.subtitle}</p>
            {o.categories && o.categories.length > 0 && (
              <p className="mt-2 text-xs font-semibold text-navy">
                Categories: {o.categories.map((c) => c.nameEn).join(", ")}
              </p>
            )}
            {o.products && o.products.length > 0 && (
              <p className="mt-2 text-xs font-semibold text-navy">
                Combo: {o.products.map((p) => p.nameEn).join(", ")}
              </p>
            )}
            <p className="mt-3 text-xs text-muted">
              {new Date(o.startAt).toLocaleString()} →{" "}
              {new Date(o.endAt).toLocaleString()}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => startEdit(o)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => toggle(o)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted"
              >
                {o.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </article>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted">
            {offers.length === 0
              ? "No offers yet."
              : "No offers match your search."}
          </p>
        )}
      </div>
    </div>
  );
}
