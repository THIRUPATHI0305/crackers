"use client";

import { createContext, useContext } from "react";
import type { ShopSettings } from "@/lib/shop-defaults";
import { DEFAULT_SHOP } from "@/lib/shop-defaults";

const ShopContext = createContext<ShopSettings>(DEFAULT_SHOP);

export function ShopProvider({
  shop,
  children,
}: {
  shop: ShopSettings;
  children: React.ReactNode;
}) {
  return <ShopContext.Provider value={shop}>{children}</ShopContext.Provider>;
}

export function useShop() {
  return useContext(ShopContext);
}
