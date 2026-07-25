import Link from "next/link";
import { BrandSaleShowcase } from "@/components/BrandSaleShowcase";
import { ProductCard } from "@/components/ProductCard";
import { getBrands, getProducts, toUiProduct } from "@/lib/catalog";

export default async function BrandsPage() {
  const [brands, allProducts] = await Promise.all([
    getBrands(),
    getProducts(),
  ]);
  const products = allProducts.map(toUiProduct);

  return (
    <div className="bg-atmosphere min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber">
            Trusted labels
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl font-semibold text-navy">
            Brands
          </h1>
          <p className="mt-3 text-muted">
            Browse products by brand from our live catalogue.
          </p>
        </div>

        <div className="mt-10 space-y-8">
          {brands.map((brand) => {
            const brandProducts = products.filter(
              (p) => p.brandSlug === brand.slug
            );
            return (
              <div key={brand.id} id={`brand-${brand.slug}`}>
                <BrandSaleShowcase
                  brand={{
                    id: brand.id,
                    name: brand.nameEn,
                    slug: brand.slug,
                    tagline: brand.taglineEn || "",
                    saleLabel: brand.saleLabel || "Brand",
                    accent: brand.accent || "#0f2744",
                    image: brand.imageUrl || "/images/product-giftbox.png",
                  }}
                  products={brandProducts}
                />
              </div>
            );
          })}
        </div>

        <section className="mt-16">
          <div className="flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-navy">
              All products
            </h2>
            <Link href="/products" className="text-sm font-semibold text-amber">
              Full catalogue
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {products.slice(0, 12).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
