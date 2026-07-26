export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  productCount: number;
};

export type Brand = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  saleLabel: string;
  accent: string;
  image: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  categorySlug: string;
  brand: string;
  brandSlug: string;
  image: string;
  originalPrice: number;
  offerPrice: number;
  stock: number;
  featured?: boolean;
  bestSeller?: boolean;
  brandedSale?: boolean;
  hasVideo?: boolean;
  description: string;
  code: string;
  safetyNote: string;
};

export type Offer = {
  id: string;
  title: string;
  subtitle: string;
  discountLabel: string;
  endsIn: string;
  type: string;
  percentOff?: number | null;
  fixedOff?: number | null;
  categorySlugs?: string[];
  categoryNames?: string[];
  products?: {
    id: string;
    slug: string;
    name: string;
    code: string;
    image: string;
    originalPrice: number;
    offerPrice: number;
    stock: number;
    categorySlug?: string;
  }[];
};

/** Storefront / billing deep-link for an offer */
export function offerHref(offer: {
  id: string;
  type: string;
  categorySlugs?: string[];
  products?: { slug: string; id: string }[];
}) {
  const type = (offer.type || "").toUpperCase();
  if (type === "CATEGORY" && offer.categorySlugs && offer.categorySlugs.length > 0) {
    return `/products?category=${offer.categorySlugs.map(encodeURIComponent).join(",")}`;
  }
  if (type === "COMBO" && offer.products && offer.products.length > 0) {
    return `/products?ids=${offer.products.map((p) => encodeURIComponent(p.id)).join(",")}`;
  }
  // FESTIVAL / ADVERTISEMENT / flat-percent: catalogue already shows list prices
  return "/products";
}

export function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function discountPercent(original: number, offer: number) {
  if (original <= 0) return 0;
  return Math.round(((original - offer) / original) * 100);
}
