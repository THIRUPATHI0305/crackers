"use client";

import Link from "next/link";
import { useShop } from "@/lib/shop-context";

export function Footer() {
  const shop = useShop();

  return (
    <footer className="mt-auto border-t border-border bg-navy text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            {shop.name || "Shop"}
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/70">
            {shop.tagline
              ? `${shop.tagline}. Enquire online, confirm on WhatsApp, track delivery with confidence.`
              : "Enquire online, confirm on WhatsApp, track delivery with confidence."}
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-bright">
            Shop
          </p>
          <ul className="mt-4 space-y-2 text-sm text-white/75">
            <li>
              <Link href="/products" className="hover:text-white">
                All products
              </Link>
            </li>
            <li>
              <Link href="/offers" className="hover:text-white">
                Festival offers
              </Link>
            </li>
            <li>
              <Link href="/loyalty" className="hover:text-white">
                Loyalty points
              </Link>
            </li>
            <li>
              <Link href="/track-order" className="hover:text-white">
                Track order
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-bright">
            Visit us
          </p>
          <ul className="mt-4 space-y-2 text-sm text-white/75">
            {shop.address ? <li>{shop.address}</li> : null}
            {shop.hours ? <li>{shop.hours}</li> : null}
            {shop.phone ? (
              <li>
                <a
                  href={`tel:${shop.phone.replace(/\s/g, "")}`}
                  className="hover:text-white"
                >
                  {shop.phone}
                </a>
              </li>
            ) : null}
            {shop.email ? (
              <li>
                <a href={`mailto:${shop.email}`} className="hover:text-white">
                  {shop.email}
                </a>
              </li>
            ) : null}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-bright">
            Ready to order?
          </p>
          <p className="mt-4 text-sm text-white/75">
            No account needed. Add products to cart and we confirm stock &
            delivery on WhatsApp.
          </p>
          <Link
            href="/enquiry"
            className="mt-5 inline-flex rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-bright"
          >
            Open cart
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {shop.name || "Shop"}. All rights
            reserved.
          </p>
          <p>
            <Link href="/admin/login" className="text-white/80 hover:text-white">
              Admin panel
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
