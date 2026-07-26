"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useEnquiryCart } from "@/lib/enquiry-cart";
import { useLocale, type LocaleCode } from "@/lib/locale";
import { useShop } from "@/lib/shop-context";
import { normalizeWaDigits } from "@/lib/whatsapp";
import { CartIcon } from "@/components/QtyStepper";

type HeaderOffer = {
  id: string;
  title: string;
  subtitle: string;
  discountLabel: string;
};

function HeaderSearch({
  className,
  inputClassName,
  onSubmitExtra,
}: {
  className?: string;
  inputClassName: string;
  onSubmitExtra?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const [q, setQ] = useState(searchParams.get("q") || "");

  useEffect(() => {
    setQ(searchParams.get("q") || "");
  }, [searchParams]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    onSubmitExtra?.();
    if (!term) {
      router.push("/products");
      return;
    }
    router.push(`/products?q=${encodeURIComponent(term)}`);
  }

  return (
    <form onSubmit={onSubmit} className={className} role="search">
      <label className="relative block">
        <span className="sr-only">{t("nav.search")}</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("nav.searchPlaceholder")}
          className={inputClassName}
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-muted hover:text-navy"
          aria-label={t("nav.search")}
        >
          ⌕
        </button>
      </label>
    </form>
  );
}

function offerBannerText(offer: HeaderOffer) {
  const parts = [offer.discountLabel, offer.title, offer.subtitle].filter(
    Boolean
  );
  return parts.join(" · ");
}

const NAV = [
  { href: "/", key: "nav.home" as const },
  { href: "/products", key: "nav.products" as const },
  { href: "/brands", key: "nav.brands" as const },
  { href: "/offers", key: "nav.offers" as const },
  { href: "/track-order", key: "nav.track" as const },
  { href: "/loyalty", key: "nav.loyalty" as const },
  { href: "/contact", key: "nav.contact" as const },
];

export function Header({ offers = [] }: { offers?: HeaderOffer[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [offerIndex, setOfferIndex] = useState(0);
  const { count } = useEnquiryCart();
  const shop = useShop();
  const { locale, setLocale, t } = useLocale();

  const langOptions = useMemo(() => {
    const opts: Array<{ code: LocaleCode; label: string }> = [];
    if (shop.languages.en) opts.push({ code: "en", label: "EN" });
    if (shop.languages.ta) opts.push({ code: "ta", label: "TA" });
    if (shop.languages.hi) opts.push({ code: "hi", label: "HI" });
    return opts.length > 0 ? opts : [{ code: "en" as LocaleCode, label: "EN" }];
  }, [shop.languages]);

  useEffect(() => {
    if (offers.length <= 1) return;
    const timer = window.setInterval(() => {
      setOfferIndex((i) => (i + 1) % offers.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [offers.length]);

  const activeOffer = offers[offerIndex] || offers[0];
  const topBanner =
    (activeOffer ? offerBannerText(activeOffer) : "") ||
    shop.headerBanner.trim() ||
    shop.tagline.trim() ||
    "";

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-surface/90 backdrop-blur-md">
      {topBanner ? (
        <div className="bg-navy text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-xs sm:text-sm">
            <Link
              href="/offers"
              className="min-w-0 flex-1 truncate font-medium tracking-wide hover:text-amber-bright"
            >
              {topBanner}
            </Link>
            {shop.phone ? (
              <a
                href={`tel:${shop.phone.replace(/\s/g, "")}`}
                className="hidden shrink-0 font-medium text-amber-bright sm:inline"
              >
                {t("nav.call")} {shop.phone}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="group flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-sm font-bold tracking-tight text-white shadow-sm">
            {(shop.name || "Shop")
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() || "")
              .join("") || "SH"}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-[family-name:var(--font-display)] text-lg font-semibold leading-tight text-navy sm:text-xl">
              {shop.name || "Shop"}
            </span>
            {shop.tagline ? (
              <span className="hidden text-xs text-muted sm:block">
                {shop.tagline}
              </span>
            ) : null}
          </span>
        </Link>

        <Suspense
          fallback={<div className="mx-auto hidden max-w-md flex-1 md:block" />}
        >
          <HeaderSearch
            className="mx-auto hidden max-w-md flex-1 md:block"
            inputClassName="w-full rounded-full border border-border bg-surface-muted/70 py-2.5 pl-4 pr-10 text-sm outline-none transition focus:border-amber focus:bg-surface focus:ring-2 focus:ring-amber/20"
          />
        </Suspense>

        <div className="ml-auto flex items-center gap-2">
          {langOptions.length > 1 ? (
            <div
              className="flex rounded-full border border-border p-0.5 text-xs font-semibold"
              role="group"
              aria-label="Language"
            >
              {langOptions.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLocale(l.code)}
                  className={`rounded-full px-2.5 py-1 transition ${
                    locale === l.code
                      ? "bg-navy text-white"
                      : "text-muted hover:text-navy"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          ) : null}

          <Link
            href="/enquiry"
            className="relative inline-flex h-10 items-center gap-1.5 rounded-full bg-amber px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-bright sm:px-4"
            aria-label={`${t("nav.cart")}${count ? `, ${count}` : ""}`}
          >
            <CartIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t("nav.cart")}</span>
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-navy px-1 text-[10px] font-bold text-white">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>

          {normalizeWaDigits(shop.whatsapp) ? (
            <a
              href={`https://wa.me/${normalizeWaDigits(shop.whatsapp)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-3 py-2 text-sm font-semibold text-[#128C7E] transition hover:bg-[#25D366]/20"
            >
              WhatsApp
            </a>
          ) : null}

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-navy md:hidden"
            aria-label={t("nav.openMenu")}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      <nav className="mx-auto hidden max-w-7xl gap-1 px-4 pb-3 md:flex">
        {NAV.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-navy text-white"
                  : "text-muted hover:bg-surface-muted hover:text-navy"
              }`}
            >
              {t(link.key)}
            </Link>
          );
        })}
      </nav>

      {open && (
        <div className="border-t border-border bg-surface px-4 py-3 md:hidden">
          <Suspense fallback={null}>
            <HeaderSearch
              className="mb-3"
              onSubmitExtra={() => setOpen(false)}
              inputClassName="w-full rounded-xl border border-border bg-surface-muted px-3 py-2.5 pr-10 text-sm outline-none focus:border-amber"
            />
          </Suspense>
          <div className="flex flex-col gap-1">
            {NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-navy hover:bg-surface-muted"
              >
                {t(link.key)}
              </Link>
            ))}
            <Link
              href="/enquiry"
              onClick={() => setOpen(false)}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-amber px-3 py-2.5 text-center text-sm font-semibold text-white"
            >
              <CartIcon className="h-4 w-4" />
              {t("nav.viewCart")}
              {count > 0 ? ` (${count})` : ""}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
