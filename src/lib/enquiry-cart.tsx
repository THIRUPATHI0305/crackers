"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type EnquiryCartItem = {
  productId: string;
  slug: string;
  name: string;
  image: string;
  /** Offer / selling price */
  price: number;
  /** MRP before discount */
  originalPrice: number;
  quantity: number;
  maxStock?: number;
  /** Needed for CATEGORY promo offers */
  categorySlug?: string;
};

type CartCtx = {
  items: EnquiryCartItem[];
  count: number;
  estimated: number;
  mrpTotal: number;
  savedAmount: number;
  addItem: (
    item: Omit<EnquiryCartItem, "quantity">,
    qty?: number
  ) => void;
  setQuantity: (productId: string, quantity: number) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  removeItem: (productId: string) => void;
  /** Replace cart after reconciling with live catalogue (id/slug/price). */
  replaceItems: (next: EnquiryCartItem[]) => void;
  getQty: (productId: string) => number;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "sn_enquiry_cart";

export function EnquiryCartProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<EnquiryCartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  // Backfill MRP for cart rows saved before originalPrice was stored
  useEffect(() => {
    if (!ready) return;
    const missing = items.filter((i) => !i.originalPrice || i.originalPrice <= 0);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const updates: Record<string, number> = {};
      await Promise.all(
        missing.map(async (item) => {
          try {
            const res = await fetch(`/api/products/${item.slug}`);
            if (!res.ok) return;
            const data = await res.json();
            const op = data?.product?.originalPrice;
            if (typeof op === "number" && op > 0) {
              updates[item.productId] = op;
            }
          } catch {
            /* ignore */
          }
        })
      );
      if (cancelled || Object.keys(updates).length === 0) return;
      setItems((prev) =>
        prev.map((p) =>
          updates[p.productId]
            ? { ...p, originalPrice: updates[p.productId] }
            : p
        )
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps — run once after load


  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, ready]);

  const value = useMemo<CartCtx>(() => {
    const clamp = (n: number, max = 999) =>
      Math.max(0, Math.min(max, Math.floor(n)));

    const normalize = (item: EnquiryCartItem): EnquiryCartItem => ({
      ...item,
      originalPrice:
        item.originalPrice && item.originalPrice > 0
          ? item.originalPrice
          : item.price,
    });

    const setQuantity: CartCtx["setQuantity"] = (productId, quantity) => {
      setItems((prev) => {
        const target = prev.find((p) => p.productId === productId);
        const max = target?.maxStock ?? 999;
        const nextQty = clamp(quantity, max);
        if (nextQty <= 0) {
          return prev.filter((p) => p.productId !== productId);
        }
        return prev.map((p) =>
          p.productId === productId ? { ...p, quantity: nextQty } : p
        );
      });
    };

    const addItem: CartCtx["addItem"] = (item, qty = 1) => {
      setItems((prev) => {
        const existing = prev.find((p) => p.productId === item.productId);
        const max = item.maxStock ?? existing?.maxStock ?? 999;
        const originalPrice =
          item.originalPrice && item.originalPrice > 0
            ? item.originalPrice
            : item.price;
        if (existing) {
          return prev.map((p) =>
            p.productId === item.productId
              ? {
                  ...p,
                  ...item,
                  originalPrice,
                  maxStock: max,
                  quantity: clamp(p.quantity + qty, max),
                }
              : p
          );
        }
        return [
          ...prev,
          {
            ...item,
            originalPrice,
            maxStock: max,
            quantity: clamp(qty, max) || 1,
          },
        ];
      });
    };

    const normalized = items.map(normalize);
    const mrpTotal = normalized.reduce(
      (s, i) => s + i.originalPrice * i.quantity,
      0
    );
    const estimated = normalized.reduce(
      (s, i) => s + i.price * i.quantity,
      0
    );

    return {
      items: normalized,
      count: normalized.reduce((s, i) => s + i.quantity, 0),
      estimated,
      mrpTotal,
      savedAmount: Math.max(0, mrpTotal - estimated),
      addItem,
      setQuantity,
      increment: (productId) => {
        const current = items.find((p) => p.productId === productId);
        if (!current) return;
        setQuantity(productId, current.quantity + 1);
      },
      decrement: (productId) => {
        const current = items.find((p) => p.productId === productId);
        if (!current) return;
        setQuantity(productId, current.quantity - 1);
      },
      removeItem: (productId) =>
        setItems((prev) => prev.filter((p) => p.productId !== productId)),
      replaceItems: (next) => setItems(next.map(normalize)),
      getQty: (productId) =>
        items.find((p) => p.productId === productId)?.quantity ?? 0,
      clear: () => setItems([]),
    };
  }, [items]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEnquiryCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEnquiryCart must be used within provider");
  return ctx;
}
