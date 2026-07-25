"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ImageUploadField } from "@/components/admin/ImageUploadField";

type Option = { id: string; nameEn: string };

type ProductFormValues = {
  nameEn: string;
  nameTa: string;
  code: string;
  slug: string;
  categoryId: string;
  brandId: string;
  originalPrice: string;
  offerPrice: string;
  stock: string;
  minStock: string;
  imageUrl: string;
  descriptionEn: string;
  descriptionTa: string;
  safetyNoteEn: string;
  youtubeUrl: string;
  showVideoOnCard: boolean;
  showVideoOnDetails: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  isBrandedSale: boolean;
  isActive: boolean;
};

const empty: ProductFormValues = {
  nameEn: "",
  nameTa: "",
  code: "",
  slug: "",
  categoryId: "",
  brandId: "",
  originalPrice: "",
  offerPrice: "",
  stock: "0",
  minStock: "10",
  imageUrl: "/images/product-sparklers.png",
  descriptionEn: "",
  descriptionTa: "",
  safetyNoteEn: "",
  youtubeUrl: "",
  showVideoOnCard: true,
  showVideoOnDetails: true,
  isFeatured: false,
  isBestSeller: false,
  isBrandedSale: false,
  isActive: true,
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function ProductForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>(empty);
  const [categories, setCategories] = useState<Option[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(!productId);

  const videoId = values.youtubeUrl.match(
    /(?:youtu\.be\/|v=|shorts\/)([A-Za-z0-9_-]{6,})/
  )?.[1];

  useEffect(() => {
    async function boot() {
      const [cats, brandRes, nextCodeRes] = await Promise.all([
        fetch("/api/admin/categories"),
        fetch("/api/brands"),
        productId
          ? Promise.resolve(null)
          : fetch("/api/admin/products?nextCode=1"),
      ]);
      const catJson = await cats.json();
      const brandJson = await brandRes.json();
      if (cats.ok) {
        setCategories(
          (catJson.categories || []).map((c: Option) => ({
            id: c.id,
            nameEn: c.nameEn,
          }))
        );
      }
      if (brandRes.ok) {
        setBrands(
          (brandJson.brands || []).map((b: Option) => ({
            id: b.id,
            nameEn: b.nameEn,
          }))
        );
      }

      if (!productId && nextCodeRes?.ok) {
        const nextJson = await nextCodeRes.json();
        if (nextJson.code) {
          setValues((v) => ({ ...v, code: nextJson.code }));
        }
      }

      if (productId) {
        const res = await fetch(`/api/admin/products/${productId}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error?.message || "Product not found");
          setReady(true);
          return;
        }
        const p = data.product;
        setValues({
          nameEn: p.nameEn || "",
          nameTa: p.nameTa || "",
          code: p.code || "",
          slug: p.slug || "",
          categoryId: p.categoryId || "",
          brandId: p.brandId || "",
          originalPrice: String(p.originalPrice ?? ""),
          offerPrice: String(p.offerPrice ?? ""),
          stock: String(p.stock ?? 0),
          minStock: String(p.minStock ?? 10),
          imageUrl: p.imageUrl || "/images/product-sparklers.png",
          descriptionEn: p.descriptionEn || "",
          descriptionTa: p.descriptionTa || "",
          safetyNoteEn: p.safetyNoteEn || "",
          youtubeUrl: p.youtubeUrl || "",
          showVideoOnCard: !!p.showVideoOnCard,
          showVideoOnDetails: !!p.showVideoOnDetails,
          isFeatured: !!p.isFeatured,
          isBestSeller: !!p.isBestSeller,
          isBrandedSale: !!p.isBrandedSale,
          isActive: !!p.isActive,
        });
      }
      setReady(true);
    }
    boot();
  }, [productId]);

  function setField<K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K]
  ) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "nameEn" && !productId) {
        next.slug = slugify(String(value));
      }
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const payload = {
      id: productId,
      nameEn: values.nameEn,
      nameTa: values.nameTa || undefined,
      // Server auto-generates code on create; edit keeps existing
      code: productId ? values.code : undefined,
      slug: values.slug || slugify(values.nameEn),
      categoryId: values.categoryId,
      brandId: values.brandId || null,
      descriptionEn: values.descriptionEn || undefined,
      descriptionTa: values.descriptionTa || undefined,
      safetyNoteEn: values.safetyNoteEn || undefined,
      originalPrice: Number(values.originalPrice),
      offerPrice: Number(values.offerPrice),
      stock: Number(values.stock),
      minStock: Number(values.minStock),
      isActive: values.isActive,
      isFeatured: values.isFeatured,
      isBestSeller: false,
      isBrandedSale: false,
      imageUrl: values.imageUrl || undefined,
      youtubeUrl: values.youtubeUrl || "",
      showVideoOnCard: values.showVideoOnCard,
      showVideoOnDetails: values.showVideoOnDetails,
    };

    const res = await fetch("/api/admin/products", {
      method: productId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      const fields = data?.error?.fields;
      const first =
        fields &&
        Object.values(fields as Record<string, string[]>)
          .flat()
          .join("; ");
      setError(first || data?.error?.message || "Save failed");
      return;
    }
    router.push("/admin/products");
    router.refresh();
  }

  if (!ready) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
          {productId ? "Edit product" : "Add product"}
        </h1>
        <Link href="/admin/products" className="text-sm font-semibold text-muted">
          ← Back
        </Link>
      </div>

      <form
        className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-sm"
        onSubmit={onSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-navy sm:col-span-2">
            Product name (English)
            <input
              required
              value={values.nameEn}
              onChange={(e) => setField("nameEn", e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            />
          </label>
          <label className="text-sm font-semibold text-navy sm:col-span-2">
            Product name (Tamil)
            <input
              value={values.nameTa}
              onChange={(e) => setField("nameTa", e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            />
          </label>
          <label className="text-sm font-semibold text-navy">
            Product code
            <input
              readOnly
              value={values.code || (productId ? "" : "Generating…")}
              className="mt-1.5 w-full cursor-not-allowed rounded-xl border border-border bg-surface-muted/80 px-4 py-3 text-sm font-semibold text-navy outline-none"
            />
            <span className="mt-1 block text-xs font-normal text-muted">
              {productId
                ? "Code is fixed after create"
                : "Auto-generated incremental ID (PRD-0001, PRD-0002…)"}
            </span>
          </label>
          <label className="text-sm font-semibold text-navy">
            Slug
            <input
              required
              value={values.slug}
              onChange={(e) => setField("slug", e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            />
          </label>
          <label className="text-sm font-semibold text-navy">
            Category
            <select
              required
              value={values.categoryId}
              onChange={(e) => setField("categoryId", e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameEn}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-navy">
            Brand
            <select
              value={values.brandId}
              onChange={(e) => setField("brandId", e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            >
              <option value="">No brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nameEn}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-navy">
            Original price
            <input
              required
              type="number"
              min={0}
              step="1"
              value={values.originalPrice}
              onChange={(e) => setField("originalPrice", e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            />
          </label>
          <label className="text-sm font-semibold text-navy">
            Offer price
            <input
              required
              type="number"
              min={0}
              step="1"
              value={values.offerPrice}
              onChange={(e) => setField("offerPrice", e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            />
          </label>
          <label className="text-sm font-semibold text-navy">
            Stock
            <input
              required
              type="number"
              min={0}
              value={values.stock}
              onChange={(e) => setField("stock", e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            />
          </label>
          <label className="text-sm font-semibold text-navy">
            Min stock alert
            <input
              type="number"
              min={0}
              value={values.minStock}
              onChange={(e) => setField("minStock", e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
            />
          </label>
          <div className="sm:col-span-2">
            <ImageUploadField
              label="Product image"
              folder="products"
              value={values.imageUrl}
              fallback="/images/product-sparklers.png"
              onChange={(url) => setField("imageUrl", url)}
            />
          </div>
        </div>

        <label className="block text-sm font-semibold text-navy">
          English description
          <textarea
            rows={3}
            value={values.descriptionEn}
            onChange={(e) => setField("descriptionEn", e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
          />
        </label>
        <label className="block text-sm font-semibold text-navy">
          Tamil description
          <textarea
            rows={3}
            value={values.descriptionTa}
            onChange={(e) => setField("descriptionTa", e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
          />
        </label>
        <label className="block text-sm font-semibold text-navy">
          Safety note
          <textarea
            rows={2}
            value={values.safetyNoteEn}
            onChange={(e) => setField("safetyNoteEn", e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm outline-none focus:border-amber"
          />
        </label>

        <div className="rounded-2xl border border-border bg-surface-muted/50 p-4">
          <p className="text-sm font-bold text-navy">YouTube product video</p>
          <input
            value={values.youtubeUrl}
            onChange={(e) => {
              setField("youtubeUrl", e.target.value);
              setPreview(false);
            }}
            placeholder="https://www.youtube.com/watch?v=…"
            className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-amber"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPreview(true)}
              className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white"
            >
              Preview video
            </button>
            <button
              type="button"
              onClick={() => {
                setField("youtubeUrl", "");
                setPreview(false);
              }}
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-danger"
            >
              Remove video link
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-navy">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={values.showVideoOnCard}
                onChange={(e) => setField("showVideoOnCard", e.target.checked)}
                className="accent-amber"
              />
              Show on product card
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={values.showVideoOnDetails}
                onChange={(e) =>
                  setField("showVideoOnDetails", e.target.checked)
                }
                className="accent-amber"
              />
              Show on details page
            </label>
          </div>
          {preview && videoId && (
            <div className="mt-4 aspect-video overflow-hidden rounded-xl bg-navy">
              <iframe
                title="YouTube preview"
                src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                className="h-full w-full"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-navy">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={values.isFeatured}
              onChange={(e) => setField("isFeatured", e.target.checked)}
              className="accent-amber"
            />{" "}
            Featured
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={values.isActive}
              onChange={(e) => setField("isActive", e.target.checked)}
              className="accent-amber"
            />{" "}
            Active
          </label>
        </div>

        {error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-amber px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save product"}
        </button>
      </form>
    </div>
  );
}
