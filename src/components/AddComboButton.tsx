"use client";

import { useState } from "react";
import { useEnquiryCart } from "@/lib/enquiry-cart";

type ComboProduct = {
  id: string;
  slug: string;
  name: string;
  image: string;
  offerPrice: number;
  originalPrice: number;
  stock: number;
  categorySlug?: string;
};

export function AddComboButton({ products }: { products: ComboProduct[] }) {
  const { addItem } = useEnquiryCart();
  const [msg, setMsg] = useState("");

  function addCombo() {
    const available = products.filter((p) => p.stock > 0);
    if (available.length < products.length) {
      setMsg("Some combo items are out of stock");
    }
    if (available.length === 0) {
      setMsg("Combo products are out of stock");
      return;
    }
    for (const p of available) {
      addItem(
        {
          productId: p.id,
          slug: p.slug,
          name: p.name,
          image: p.image,
          price: p.offerPrice,
          originalPrice: p.originalPrice,
          maxStock: p.stock,
          categorySlug: p.categorySlug,
        },
        1
      );
    }
    setMsg(
      available.length === products.length
        ? `Added ${available.length} combo items to enquiry`
        : `Added ${available.length} of ${products.length} items`
    );
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={addCombo}
        className="rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-bright"
      >
        Add combo to cart
      </button>
      {msg ? <p className="mt-2 text-xs font-semibold text-success">{msg}</p> : null}
    </div>
  );
}
