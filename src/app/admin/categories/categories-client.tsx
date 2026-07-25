"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import {
  AdminSearchBar,
  matchesQuery,
} from "@/components/admin/AdminSearchBar";

type Category = {
  id: string;
  nameEn: string;
  nameTa: string | null;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
  sortOrder: number;
  isActive: boolean;
};

const blank = {
  nameEn: "",
  nameTa: "",
  slug: "",
  description: "",
  imageUrl: "/images/category-green.png",
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

export default function AdminCategoriesClient({
  initialCategories,
}: {
  initialCategories: Category[];
}) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  async function load() {
    const res = await fetch("/api/admin/categories");
    const data = await res.json();
    if (res.ok) {
      setCategories(data.categories || []);
      setError("");
    } else {
      setError(data?.error?.message || "Could not reload categories");
    }
  }

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

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
      sortOrder: String(categories.length + 1),
    });
    setOpen(true);
    setError("");
    setMsg("");
  }

  function startEdit(c: Category) {
    setEditing(c.id);
    setForm({
      nameEn: c.nameEn,
      nameTa: c.nameTa || "",
      slug: c.slug,
      description: c.description || "",
      imageUrl: c.imageUrl || "/images/category-green.png",
      sortOrder: String(c.sortOrder),
      isActive: c.isActive,
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
      description: form.description || undefined,
      imageUrl: form.imageUrl,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };
    const res = await fetch("/api/admin/categories", {
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
    setMsg(editing ? "Category updated" : "Category created");
    setOpen(false);
    load();
  }

  async function toggleActive(c: Category) {
    const res = await fetch("/api/admin/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: c.id,
        nameEn: c.nameEn,
        nameTa: c.nameTa || undefined,
        slug: c.slug,
        description: c.description || undefined,
        imageUrl: c.imageUrl || undefined,
        sortOrder: c.sortOrder,
        isActive: !c.isActive,
      }),
    });
    if (res.ok) {
      setMsg(c.isActive ? "Category deactivated" : "Category activated");
      load();
    }
  }

  const filtered = useMemo(
    () =>
      categories.filter((c) =>
        matchesQuery(q, c.nameEn, c.nameTa, c.slug, c.description)
      ),
    [categories, q]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
            Categories
          </h1>
          <p className="mt-1 text-sm text-muted">
            Live from PostgreSQL · {categories.length} categories
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-bright"
        >
          Add category
        </button>
      </div>

      <AdminSearchBar
        value={q}
        onChange={setQ}
        placeholder="Search category name / slug…"
      />

      {error && !open && (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {msg && (
        <p className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
          {msg}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => (
          <article
            key={c.id}
            className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition hover:border-navy/20"
          >
            <div className="relative aspect-[16/10]">
              <Image
                src={c.imageUrl || "/images/category-green.png"}
                alt={c.nameEn}
                fill
                className="object-cover"
                sizes="33vw"
              />
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold text-navy">{c.nameEn}</h2>
                  <p className="text-xs text-muted">
                    {c.slug} · Order #{c.sortOrder}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    c.isActive
                      ? "bg-success/15 text-success"
                      : "bg-danger/10 text-danger"
                  }`}
                >
                  {c.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted">
                {c.description}
              </p>
              <p className="mt-2 text-xs font-semibold text-navy">
                {c.productCount} products
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(c)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy hover:bg-surface-muted"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(c)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:bg-surface-muted"
                >
                  {c.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          </article>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">
            {categories.length === 0
              ? "No categories yet. Click Add category to create one."
              : "No categories match your search."}
          </p>
        )}
      </div>

      {/* Add / Edit popup */}
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
            aria-labelledby="category-modal-title"
            className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-surface shadow-2xl sm:mx-4 sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber">
                  {editing ? "Update" : "Create"}
                </p>
                <h2
                  id="category-modal-title"
                  className="font-[family-name:var(--font-display)] text-2xl font-semibold text-navy"
                >
                  {editing ? "Edit category" : "Add category"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition hover:bg-surface-muted hover:text-navy"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={save}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div className="space-y-4 overflow-y-auto px-5 py-4">
                <ImageUploadField
                  label="Category image"
                  folder="categories"
                  value={form.imageUrl}
                  fallback="/images/category-green.png"
                  onChange={(url) =>
                    setForm((f) => ({ ...f, imageUrl: url }))
                  }
                />

                <label className="block text-sm font-semibold text-navy">
                  Name (English)
                  <input
                    required
                    autoFocus
                    value={form.nameEn}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        nameEn: e.target.value,
                        slug: editing ? f.slug : slugify(e.target.value),
                      }))
                    }
                    placeholder="e.g. Sparklers"
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber focus:bg-surface"
                  />
                </label>

                <label className="block text-sm font-semibold text-navy">
                  Name (Tamil)
                  <input
                    value={form.nameTa}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nameTa: e.target.value }))
                    }
                    placeholder="Optional"
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber focus:bg-surface"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-navy">
                    Slug
                    <input
                      required
                      value={form.slug}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, slug: e.target.value }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber focus:bg-surface"
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
                      className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber focus:bg-surface"
                    />
                  </label>
                </div>

                <label className="block text-sm font-semibold text-navy">
                  Description
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="Short category description"
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber focus:bg-surface"
                  />
                </label>

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
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border bg-surface-muted/40 px-5 py-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-full bg-amber px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {loading
                    ? "Saving…"
                    : editing
                      ? "Save changes"
                      : "Create category"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loading}
                  className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
