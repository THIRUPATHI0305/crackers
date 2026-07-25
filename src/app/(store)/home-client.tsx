"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BrandSaleShowcase } from "@/components/BrandSaleShowcase";
import { CategoryCard } from "@/components/CategoryCard";
import { ProductCard } from "@/components/ProductCard";
import type { Brand, Category, Offer, Product } from "@/lib/data";
import { offerHref } from "@/lib/data";
import type { ShopSettings } from "@/lib/shop-defaults";
import { normalizeWaDigits } from "@/lib/whatsapp";

const fade = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" as const },
  transition: { duration: 0.45 },
};

type Props = {
  shop: ShopSettings;
  reviews: { name: string; city: string; rating: number; text: string }[];
  brands: Brand[];
  categories: Category[];
  offers: Offer[];
  products: Product[];
};

export default function HomeClient({
  shop,
  reviews,
  brands,
  categories,
  offers,
  products,
}: Props) {
  const featured = products.filter((p) => p.featured);

  return (
    <div className="bg-atmosphere">
      <section className="relative min-h-[78vh] overflow-hidden">
        <div className="hero-plane absolute inset-0" />
        <div className="relative mx-auto flex min-h-[78vh] max-w-7xl flex-col justify-end px-4 pb-16 pt-24 sm:justify-center sm:pb-24 sm:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-xl text-white"
          >
            <p className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              {shop.name}
            </p>
            <h1 className="mt-4 text-balance text-xl font-medium leading-snug text-white/90 sm:text-2xl">
              {shop.tagline}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70 sm:text-base">
              Browse offers, add to cart, confirm on WhatsApp — no account,
              no online payment.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="rounded-full bg-amber px-6 py-3 text-sm font-bold text-white shadow-lg shadow-amber/30 transition hover:bg-amber-bright"
              >
                Shop products
              </Link>
              <Link
                href="/brands"
                className="rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Browse brands
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <motion.div {...fade} className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-amber">
              Limited-time
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
              Current festival offers
            </h2>
          </div>
          <Link href="/offers" className="text-sm font-semibold text-navy underline-offset-4 hover:underline">
            All offers
          </Link>
        </motion.div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {offers.map((offer, i) => (
            <motion.div
              key={offer.id}
              {...fade}
              transition={{ duration: 0.45, delay: i * 0.08 }}
            >
              <Link
                href={offerHref(offer)}
                className="relative block overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-sm transition hover:border-amber/50 hover:shadow-md"
              >
                <span className="inline-flex rounded-md bg-navy px-2.5 py-1 text-xs font-bold text-white">
                  {offer.discountLabel}
                </span>
                <h3 className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold text-navy">
                  {offer.title}
                </h3>
                <p className="mt-2 text-sm text-muted">{offer.subtitle}</p>
                {offer.type === "COMBO" && offer.products && offer.products.length > 0 && (
                  <p className="mt-2 text-xs font-semibold text-navy">
                    {offer.products.map((p) => p.name).join(" + ")}
                  </p>
                )}
                {offer.type === "CATEGORY" &&
                  offer.categoryNames &&
                  offer.categoryNames.length > 0 && (
                    <p className="mt-2 text-xs font-semibold text-navy">
                      {offer.categoryNames.join(", ")}
                    </p>
                  )}
                <p className="mt-4 text-xs font-semibold text-amber">
                  {offer.endsIn} · View offer →
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {brands.length > 0 && (
        <section className="border-y border-border bg-surface py-16">
          <div className="mx-auto max-w-7xl px-4">
            <motion.div {...fade} className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-amber">
                  Brand spotlight
                </p>
                <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
                  Shop by brand
                </h2>
              </div>
              <Link href="/brands" className="text-sm font-semibold text-navy underline-offset-4 hover:underline">
                All brands
              </Link>
            </motion.div>
            <div className="mt-8 space-y-6">
              {brands.slice(0, 2).map((brand) => (
                <BrandSaleShowcase
                  key={brand.id}
                  brand={brand}
                  products={products.filter((p) => p.brandSlug === brand.slug)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-8">
        <motion.div {...fade}>
          <p className="text-sm font-semibold uppercase tracking-wider text-amber">
            Browse by type
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
            Popular categories
          </h2>
        </motion.div>
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {categories.map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <motion.div {...fade} className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-amber">
              Handpicked
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
              Featured products
            </h2>
          </div>
          <Link href="/products" className="text-sm font-semibold text-navy underline-offset-4 hover:underline">
            View all
          </Link>
        </motion.div>
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <motion.div
          {...fade}
          className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-navy to-navy-soft p-8 text-white sm:p-12"
        >
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">
            Earn points with every invoice — no login needed
          </h2>
          <p className="mt-4 text-white/75">
            ₹100 purchase = 1 point. Check balance anytime with your mobile number.
          </p>
          <Link
            href="/loyalty"
            className="mt-8 inline-flex rounded-full bg-amber px-6 py-3 text-sm font-bold text-white"
          >
            Check loyalty points
          </Link>
        </motion.div>
      </section>

      {reviews.length > 0 && (
        <section className="border-t border-border bg-surface py-16">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
              Families trust {shop.name}
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {reviews.map((r, i) => (
                <blockquote
                  key={`${r.name}-${i}`}
                  className="rounded-2xl border border-border bg-background p-6"
                >
                  <div className="flex gap-0.5 text-amber">
                    {Array.from({ length: r.rating }).map((_, j) => (
                      <span key={j}>★</span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-navy">{r.text}</p>
                  <footer className="mt-4 text-sm font-semibold text-muted">
                    {r.name}
                    {r.city ? ` · ${r.city}` : ""}
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-6 rounded-3xl border border-border bg-surface p-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
              Visit our showroom
            </h2>
            <p className="mt-3 text-muted">{shop.address}</p>
            <p className="mt-1 text-sm text-muted">{shop.hours}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {shop.mapsUrl && (
                <a
                  href={shop.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Open in Maps
                </a>
              )}
              <Link
                href="/contact"
                className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-navy"
              >
                Contact details
              </Link>
            </div>
          </div>
          <div className="flex flex-col justify-center rounded-2xl bg-surface-muted p-6">
            <p className="text-sm font-semibold text-navy">Need help choosing?</p>
            {normalizeWaDigits(shop.whatsapp) ? (
              <a
                href={`https://wa.me/${normalizeWaDigits(shop.whatsapp)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex w-fit rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Chat on WhatsApp
              </a>
            ) : (
              <Link
                href="/contact"
                className="mt-5 inline-flex w-fit rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white"
              >
                Contact us
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
