"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/data";
import { useEnquiryCart } from "@/lib/enquiry-cart";
import { QtyStepper } from "@/components/QtyStepper";

export function ProductAddControls({ product }: { product: Product }) {
  const { addItem, getQty, setQuantity } = useEnquiryCart();
  const qty = getQty(product.id);
  const inStock = product.stock > 0;
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(false), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  function handleAdd() {
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
    );
    setToast(true);
  }

  return (
    <div className="mt-4 space-y-3">
      {inStock && qty === 0 && (
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-full bg-amber px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-amber/20 transition hover:bg-amber-bright"
        >
          Add to cart
        </button>
      )}

      {inStock && qty > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <QtyStepper
            value={qty}
            min={0}
            max={product.stock}
            onChange={(next) => setQuantity(product.id, next)}
          />
          <Link
            href="/enquiry"
            className="rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white"
          >
            Go to cart
          </Link>
        </div>
      )}

      {!inStock && (
        <p className="rounded-xl bg-danger/10 px-4 py-2.5 text-sm font-semibold text-danger">
          Currently out of stock
        </p>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-border bg-surface p-4 shadow-xl md:bottom-8 md:left-auto md:right-6"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-sm font-bold text-success">
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-navy">Added to cart</p>
              <p className="mt-0.5 truncate text-xs text-muted">{product.name}</p>
              <div className="mt-3 flex gap-2">
                <Link
                  href="/enquiry"
                  className="rounded-full bg-navy px-3.5 py-1.5 text-xs font-bold text-white"
                >
                  View cart
                </Link>
                <button
                  type="button"
                  onClick={() => setToast(false)}
                  className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-navy"
                >
                  Keep shopping
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
