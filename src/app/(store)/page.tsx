import HomeClient from "./home-client";
import {
  getBrands,
  getCategories,
  getOffers,
  getProducts,
  toUiProduct,
} from "@/lib/catalog";
import { getPublicReviews, getShopSettings } from "@/lib/shop-settings";

export default async function HomePage() {
  const [brandsRaw, categoriesRaw, offersRaw, productsRaw, shop, reviews] =
    await Promise.all([
      getBrands(),
      getCategories(),
      getOffers(),
      getProducts(),
      getShopSettings(),
      getPublicReviews(),
    ]);

  const products = productsRaw.map(toUiProduct);
  const brands = brandsRaw.map((b) => ({
    id: b.id,
    name: b.nameEn,
    nameTa: b.nameTa || "",
    slug: b.slug,
    tagline: b.taglineEn || "",
    taglineTa: b.taglineTa || "",
    saleLabel: b.saleLabel || "Brand",
    accent: b.accent || "#0f2744",
    image: b.imageUrl || "/images/product-giftbox.png",
  }));
  const categories = categoriesRaw.map((c) => ({
    id: c.id,
    name: c.nameEn,
    nameTa: c.nameTa || "",
    slug: c.slug,
    description: c.description || "",
    image: c.imageUrl || "/images/product-sparklers.png",
    productCount: c.productCount,
  }));
  const offers = offersRaw.map((o) => ({
    id: o.id,
    title: o.title,
    subtitle: o.subtitle || "",
    discountLabel: o.discountLabel || "OFFER",
    endsIn: `Ends ${new Date(o.endAt).toLocaleDateString()}`,
    type: o.type,
    percentOff: o.percentOff,
    fixedOff: o.fixedOff,
    categorySlugs: o.categorySlugs,
    categoryNames: o.categoryNames,
    products: o.products,
  }));

  return (
    <HomeClient
      shop={shop}
      reviews={reviews}
      brands={brands}
      categories={categories}
      offers={offers}
      products={products}
    />
  );
}
