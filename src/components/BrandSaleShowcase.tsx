import Image from "next/image";
import Link from "next/link";
import {
  discountPercent,
  formatInr,
  type Brand,
  type Product,
} from "@/lib/data";

export function BrandSaleShowcase({
  brand,
  products,
}: {
  brand: Brand;
  products: Product[];
}) {
  const top = products[0];
  const discount = top
    ? discountPercent(top.originalPrice, top.offerPrice)
    : 0;

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative min-h-[240px] lg:min-h-[320px]">
          <Image
            src={brand.image}
            alt={brand.name}
            fill
            className="object-cover"
            sizes="(max-width:1024px) 100vw, 50vw"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${brand.accent}cc 0%, ${brand.accent}55 45%, transparent 100%)`,
            }}
          />
          <div className="absolute inset-0 flex flex-col justify-end p-6 text-white sm:p-8">
            <span className="w-fit rounded-md bg-white/20 px-2.5 py-1 text-xs font-bold backdrop-blur">
              {brand.saleLabel}
            </span>
            <h3 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">
              {brand.name}
            </h3>
            <p className="mt-2 max-w-md text-sm text-white/85">{brand.tagline}</p>
          </div>
        </div>

        <div className="flex flex-col p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-navy">
              Products
            </p>
            <Link
              href={`/brands/${brand.slug}`}
              className="text-sm font-semibold text-amber hover:underline"
            >
              View brand →
            </Link>
          </div>

          <ul className="mt-4 flex-1 space-y-3">
            {products.slice(0, 3).map((p) => {
              const off = discountPercent(p.originalPrice, p.offerPrice);
              return (
                <li key={p.id}>
                  <Link
                    href={`/products/${p.slug}`}
                    className="flex items-center gap-3 rounded-2xl border border-border/80 p-2.5 transition hover:border-navy/25 hover:bg-surface-muted/50"
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-muted">
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy">
                        {p.name}
                      </p>
                      <p className="text-xs text-muted">{p.category}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-sm font-bold text-navy">
                          {formatInr(p.offerPrice)}
                        </span>
                        <span className="text-xs text-muted line-through">
                          {formatInr(p.originalPrice)}
                        </span>
                        <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-danger">
                          {off}% OFF
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <Link
            href={`/products?brand=${brand.slug}`}
            className="mt-5 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-bold text-white transition hover:opacity-95"
            style={{ backgroundColor: brand.accent }}
          >
            Shop {brand.name} sale
            {discount > 0 ? ` · save ${discount}%` : ""}
          </Link>
        </div>
      </div>
    </article>
  );
}
