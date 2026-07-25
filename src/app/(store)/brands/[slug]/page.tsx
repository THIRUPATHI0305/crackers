import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandSaleShowcase } from "@/components/BrandSaleShowcase";
import { ProductCard } from "@/components/ProductCard";
import { getBrandBySlug, toUiProduct } from "@/lib/catalog";

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) notFound();

  const brandProducts = brand.products.map(toUiProduct);

  return (
    <div className="bg-atmosphere min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <nav className="text-sm text-muted">
          <Link href="/brands" className="hover:text-navy">
            Brands
          </Link>
          <span className="mx-2">/</span>
          <span className="text-navy">{brand.nameEn}</span>
        </nav>

        <div className="mt-6">
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

        <section className="mt-12">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-navy">
            All {brand.nameEn} products
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {brandProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
