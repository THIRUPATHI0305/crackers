import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductAddControls } from "@/components/ProductAddControls";
import { ProductCard } from "@/components/ProductCard";
import {
  getProductBySlug,
  getProducts,
  toUiProduct,
} from "@/lib/catalog";
import { discountPercent, formatInr } from "@/lib/data";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const raw = await getProductBySlug(slug);
  if (!raw) notFound();
  const product = toUiProduct(raw);
  const discount = discountPercent(product.originalPrice, product.offerPrice);
  const related = (await getProducts({ category: product.categorySlug }))
    .filter((p) => p.id !== product.id)
    .slice(0, 4)
    .map(toUiProduct);

  return (
    <div className="bg-atmosphere min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <nav className="text-sm text-muted">
          <Link href="/products" className="hover:text-navy">
            Products
          </Link>
          <span className="mx-2">/</span>
          <span className="text-navy">{product.name}</span>
        </nav>

        {/* Compact product block so related items appear sooner */}
        <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] xl:grid-cols-[minmax(0,26rem)_1fr]">
          <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-white shadow-sm lg:mx-0 lg:max-w-none">
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-contain p-3"
              priority
              sizes="(max-width:1024px) 80vw, 26rem"
            />
            <span className="absolute left-3 top-3 rounded-md bg-danger px-2 py-0.5 text-xs font-bold text-white">
              {discount}% OFF
            </span>
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber">
              {product.category} · {product.code}
            </p>
            {product.brand && product.brandSlug ? (
              <Link
                href={`/brands/${product.brandSlug}`}
                className="mt-1.5 inline-flex rounded-full border border-navy/15 bg-navy/5 px-2.5 py-0.5 text-[11px] font-bold text-navy"
              >
                {product.brand}
              </Link>
            ) : null}
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold leading-tight text-navy sm:text-3xl">
              {product.name}
            </h1>
            {product.description && (
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
                {product.description}
              </p>
            )}

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
                ? `In stock · ${product.stock} available`
                : "Out of stock"}
            </p>

            <ProductAddControls product={product} />

            {product.safetyNote && (
              <p className="mt-4 rounded-xl border border-amber/25 bg-amber/5 px-3.5 py-2.5 text-xs leading-relaxed text-muted">
                <span className="font-bold text-navy">Safety: </span>
                {product.safetyNote}
              </p>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-10 border-t border-border pt-8">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-navy sm:text-2xl">
              Related products
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
