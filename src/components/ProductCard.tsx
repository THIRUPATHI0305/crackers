"use client";

import Image from "next/image";
import Link from "next/link";
import {
  discountPercent,
  formatInr,
  type Product,
} from "@/lib/data";
import { useEnquiryCart } from "@/lib/enquiry-cart";
import { QtyStepper } from "@/components/QtyStepper";

export function ProductCard({ product }: { product: Product }) {
  const discount = discountPercent(product.originalPrice, product.offerPrice);
  const inStock = product.stock > 0;
  const { addItem, getQty, setQuantity } = useEnquiryCart();
  const qty = getQty(product.id);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(15,28,46,0.04)] transition duration-300 hover:-translate-y-0.5 hover:border-navy/20 hover:shadow-[0_12px_28px_rgba(15,39,68,0.08)]">
      <div className="relative aspect-square overflow-hidden bg-white">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-contain p-2 transition duration-500 group-hover:scale-[1.03]"
          sizes="(max-width:768px) 50vw, 25vw"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-danger px-2 py-0.5 text-xs font-bold text-white">
            {discount}% OFF
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {product.category}
          </p>
          {product.brand && product.brandSlug ? (
            <Link
              href={`/brands/${product.brandSlug}`}
              className="rounded-full border border-navy/15 bg-navy/5 px-2 py-0.5 text-[11px] font-bold text-navy hover:bg-navy/10"
            >
              {product.brand}
            </Link>
          ) : null}
        </div>
        <h3 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold leading-snug text-navy">
          <Link href={`/products/${product.slug}`} className="hover:underline">
            {product.name}
          </Link>
        </h3>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-xl font-bold text-navy">
            {formatInr(product.offerPrice)}
          </span>
          <span className="text-sm text-muted line-through">
            {formatInr(product.originalPrice)}
          </span>
        </div>

        <p
          className={`mt-2 text-xs font-semibold ${
            inStock ? "text-success" : "text-danger"
          }`}
        >
          {inStock ? `In stock · ${product.stock} left` : "Out of stock"}
        </p>

        <div className="mt-auto flex items-center gap-2 pt-4">
          {!inStock ? (
            <button
              type="button"
              disabled
              className="flex-1 rounded-xl bg-surface-muted py-2.5 text-sm font-semibold text-muted"
            >
              Out of stock
            </button>
          ) : qty === 0 ? (
            <button
              type="button"
              onClick={() =>
                addItem(
                  {
                    productId: product.id,
                    slug: product.slug,
                    name: product.name,
                    image: product.image,
                    price: product.offerPrice,
                    originalPrice: product.originalPrice,
                    maxStock: product.stock,
                    categorySlug: product.categorySlug,
                  },
                  1
                )
              }
              className="flex-1 rounded-xl bg-amber py-2.5 text-sm font-semibold text-white transition hover:bg-amber-bright"
            >
              Add
            </button>
          ) : (
            <QtyStepper
              value={qty}
              min={0}
              max={product.stock}
              size="sm"
              onChange={(next) => setQuantity(product.id, next)}
            />
          )}
          <Link
            href={`/products/${product.slug}`}
            className="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-navy transition hover:border-navy hover:bg-surface-muted"
          >
            View
          </Link>
        </div>
      </div>
    </article>
  );
}
