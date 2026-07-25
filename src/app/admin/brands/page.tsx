"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import {
  AdminSearchBar,
  matchesQuery,
} from "@/components/admin/AdminSearchBar";

type Brand = {
  id: string;
  nameEn: string;
  nameTa: string | null;
  slug: string;
  taglineEn: string | null;
  taglineTa: string | null;
  saleLabel: string | null;
  accent: string | null;
  imageUrl: string | null;
  productCount: number;
  sortOrder: number;
  isActive: boolean;
};

const blank = {
  nameEn: "",
  nameTa: "",
  slug: "",
  taglineEn: "",
  saleLabel: "",
  accent: "#0f2744",
  imageUrl: "/images/product-giftbox.png",
  sortOrder: "0",
  isActive: true,
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  async function load() {
    const res = await fetch("/api/admin/brands");
    const data = await res.json();
    if (res.ok) setBrands(data.brands || []);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function startCreate() {
    setEditing(null);
    setForm({
      ...blank,
      sortOrder: String(brands.length + 1),
    });
    setOpen(true);
    setError("");
    setMsg("");
  }

  function startEdit(b: Brand) {
    setEditing(b.id);
    setForm({
      nameEn: b.nameEn,
      nameTa: b.nameTa || "",
      slug: b.slug,
      taglineEn: b.taglineEn || "",
      saleLabel: b.saleLabel || "",
      accent: b.accent || "#0f2744",
      imageUrl: b.imageUrl || "/images/product-giftbox.png",
      sortOrder: String(b.sortOrder),
      isActive: b.isActive,
    });
    setOpen(true);
    setError("");
    setMsg("");
  }

  function closeModal() {
    if (loading) return;
    setOpen(false);
    setError("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const payload = {
      id: editing || undefined,
      nameEn: form.nameEn,
      nameTa: form.nameTa || undefined,
      slug: form.slug || slugify(form.nameEn),
      taglineEn: form.taglineEn || undefined,
      saleLabel: form.saleLabel || undefined,
      accent: form.accent || "#0f2744",
      imageUrl: form.imageUrl,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };
    const res = await fetch("/api/admin/brands", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data?.error?.message || "Save failed");
      return;
    }
    setMsg(editing ? "Brand updated" : "Brand created");
    setOpen(false);
    load();
  }

  async function toggleActive(b: Brand) {
    const res = await fetch("/api/admin/brands", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: b.id,
        nameEn: b.nameEn,
        nameTa: b.nameTa || undefined,
        slug: b.slug,
        taglineEn: b.taglineEn || undefined,
        saleLabel: b.saleLabel || undefined,
        accent: b.accent || undefined,
        imageUrl: b.imageUrl || undefined,
        sortOrder: b.sortOrder,
        isActive: !b.isActive,
      }),
    });
    if (res.ok) {
      setMsg(b.isActive ? "Brand deactivated" : "Brand activated");
      load();
    }
  }

  async function removeBrand(b: Brand) {
    const ok = window.confirm(
      `Remove brand “${b.nameEn}”? Products keep selling but lose this brand link.`
    );
    if (!ok) return;
    const res = await fetch("/api/admin/brands", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error?.message || "Could not remove brand");
      return;
    }
    setMsg(`Removed ${b.nameEn}`);
    load();
  }

  const filtered = useMemo(
    () =>
      brands.filter((b) =>
        matchesQuery(q, b.nameEn, b.nameTa, b.slug, b.taglineEn, b.saleLabel)
      ),
    [brands, q]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
            Brands
          </h1>
          <p className="mt-1 text-sm text-muted">
            Create, edit, deactivate or remove brands · used on products &amp;
            storefront
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-bright"
        >
          Add brand
        </button>
      </div>

      <AdminSearchBar
        value={q}
        onChange={setQ}
        placeholder="Search brand name / slug / tagline…"
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((b) => (
          <article
            key={b.id}
            className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition hover:border-navy/20"
          >
            <div
              className="relative aspect-[16/10]"
              style={{ backgroundColor: b.accent || "#0f2744" }}
            >
              <Image
                src={b.imageUrl || "/images/product-giftbox.png"}
                alt={b.nameEn}
                fill
                className="object-cover"
                sizes="33vw"
              />
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold text-navy">{b.nameEn}</h2>
                  <p className="text-xs text-muted">
                    {b.slug} · Order #{b.sortOrder}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    b.isActive
                      ? "bg-success/15 text-success"
                      : "bg-danger/10 text-danger"
                  }`}
                >
                  {b.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              {b.saleLabel && (
                <p className="mt-2 text-xs font-semibold text-amber">
                  {b.saleLabel}
                </p>
              )}
              <p className="mt-2 line-clamp-2 text-sm text-muted">
                {b.taglineEn || "No tagline"}
              </p>
              <p className="mt-2 text-xs font-semibold text-navy">
                {b.productCount} products
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(b)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy hover:bg-surface-muted"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(b)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:bg-surface-muted"
                >
                  {b.isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => removeBrand(b)}
                  className="rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/5"
                >
                  Remove
                </button>
              </div>
            </div>
          </article>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">
            {brands.length === 0
              ? "No brands yet. Click Add brand to create one."
              : "No brands match your search."}
          </p>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-navy/50 backdrop-blur-[2px]"
            onClick={closeModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="brand-modal-title"
            className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-surface shadow-2xl sm:mx-4 sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber">
                  {editing ? "Update" : "Create"}
                </p>
                <h2
                  id="brand-modal-title"
                  className="font-[family-name:var(--font-display)] text-2xl font-semibold text-navy"
                >
                  {editing ? "Edit brand" : "Add brand"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-border px-3 py-1 text-sm font-semibold text-muted"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={save}
              className="space-y-4 overflow-y-auto px-5 py-4"
            >
              <label className="block text-sm font-semibold text-navy">
                Name (English)
                <input
                  required
                  value={form.nameEn}
                  onChange={(e) => {
                    const nameEn = e.target.value;
                    setForm((f) => ({
                      ...f,
                      nameEn,
                      slug: f.slug || slugify(nameEn),
                    }));
                  }}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
                />
              </label>
              <label className="block text-sm font-semibold text-navy">
                Name (Tamil)
                <input
                  value={form.nameTa}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nameTa: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
                />
              </label>
              <label className="block text-sm font-semibold text-navy">
                Slug
                <input
                  required
                  value={form.slug}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      slug: slugify(e.target.value) || e.target.value,
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
                />
              </label>
              <label className="block text-sm font-semibold text-navy">
                Tagline
                <input
                  value={form.taglineEn}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, taglineEn: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
                />
              </label>
              <label className="block text-sm font-semibold text-navy">
                Sale label
                <input
                  value={form.saleLabel}
                  placeholder="Brand sale · up to 30% off"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, saleLabel: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-semibold text-navy">
                  Accent colour
                  <input
                    type="color"
                    value={form.accent || "#0f2744"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, accent: e.target.value }))
                    }
                    className="mt-1.5 h-11 w-full cursor-pointer rounded-xl border border-border bg-surface-muted"
                  />
                </label>
                <label className="block text-sm font-semibold text-navy">
                  Sort order
                  <input
                    type="number"
                    min={0}
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sortOrder: e.target.value }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
                  />
                </label>
              </div>

              <ImageUploadField
                label="Brand image"
                folder="brands"
                value={form.imageUrl}
                fallback="/images/product-giftbox.png"
                onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
              />

              <label className="flex items-center gap-2 text-sm font-semibold text-navy">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                  className="accent-amber"
                />
                Active on storefront
              </label>

              {error && (
                <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}

              <div className="sticky bottom-0 flex gap-2 border-t border-border bg-surface py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-full border border-border py-3 text-sm font-semibold text-navy"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-full bg-amber py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {loading ? "Saving…" : editing ? "Update brand" : "Create brand"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
