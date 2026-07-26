"use client";

import Image from "next/image";
import Link from "next/link";
import { ProductAddControls } from "@/components/ProductAddControls";
import { formatInr, type Product } from "@/lib/data";
import { useLocale } from "@/lib/locale";

export function ProductDetailBreadcrumb({ product }: { product: Product }) {
  const { t, L } = useLocale();
  return (
    <nav className="text-sm text-muted">
      <Link href="/products" className="hover:text-navy">
        {t("nav.products")}
      </Link>
      <span className="mx-2">/</span>
      <span className="text-navy">{L(product.name, product.nameTa)}</span>
    </nav>
  );
}

export function ProductDetailMedia({
  product,
  discount,
}: {
  product: Product;
  discount: number;
}) {
  const { L } = useLocale();
  const name = L(product.name, product.nameTa);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-white shadow-sm lg:mx-0 lg:max-w-none">
      <Image
        src={product.image}
        alt={name}
        fill
        className="object-contain p-3"
        priority
        sizes="(max-width:1024px) 80vw, 26rem"
      />
      <span className="absolute left-3 top-3 rounded-md bg-danger px-2 py-0.5 text-xs font-bold text-white">
        {discount}% OFF
      </span>
    </div>
  );
}

export function ProductDetailInfo({ product }: { product: Product }) {
  const { t, L } = useLocale();
  const name = L(product.name, product.nameTa);
  const category = L(product.category, product.categoryTa);
  const brand = L(product.brand, product.brandTa);
  const description = L(product.description, product.descriptionTa);
  const safety = L(product.safetyNote, product.safetyNoteTa);

  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber">
        {category} · {product.code}
      </p>
      {brand && product.brandSlug ? (
        <Link
          href={`/brands/${product.brandSlug}`}
          className="mt-1.5 inline-flex rounded-full border border-navy/15 bg-navy/5 px-2.5 py-0.5 text-[11px] font-bold text-navy"
        >
          {brand}
        </Link>
      ) : null}
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold leading-tight text-navy sm:text-3xl">
        {name}
      </h1>
      {description ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
          {description}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-baseline gap-2.5">
        <span className="text-2xl font-bold text-navy">
          {formatInr(product.offerPrice)}
        </span>
        <span className="text-base text-muted line-through">
          {formatInr(product.originalPrice)}
        </span>
      </div>

      <p
        className={`mt-2 text-sm font-semibold ${
          product.stock > 0 ? "text-success" : "text-danger"
        }`}
      >
        {product.stock > 0
          ? `${t("common.inStock")} · ${product.stock} ${t("common.available")}`
          : t("common.outOfStock")}
      </p>

      <ProductAddControls product={{ ...product, name }} />

      {safety ? (
        <p className="mt-4 rounded-xl border border-amber/25 bg-amber/5 px-3.5 py-2.5 text-xs leading-relaxed text-muted">
          <span className="font-bold text-navy">{t("common.safety")}: </span>
          {safety}
        </p>
      ) : null}
    </div>
  );
}

export function RelatedHeading() {
  const { t } = useLocale();
  return (
    <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-navy sm:text-2xl">
      {t("common.related")}
    </h2>
  );
}
