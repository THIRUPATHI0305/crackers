import Link from "next/link";
import { AddComboButton } from "@/components/AddComboButton";
import { getOffers } from "@/lib/catalog";
import { formatInr, offerHref } from "@/lib/data";

export default async function OffersPage() {
  const offers = await getOffers();

  return (
    <div className="bg-atmosphere min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber">
            Save more
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl font-semibold text-navy">
            Festival offers
          </h1>
          <p className="mt-3 text-muted">
            Festival list prices are already on products. Combo / category /
            flat offers apply when those items are on your enquiry or bill.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {offers.length === 0 && (
            <p className="text-muted">No active offers right now.</p>
          )}
          {offers.map((offer) => {
            const type = offer.type.toUpperCase();
            const href = offerHref({
              id: offer.id,
              type: offer.type,
              categorySlugs: offer.categorySlugs,
              products: offer.products,
            });
            const isCombo = type === "COMBO" && offer.products.length > 0;
            const isCategory =
              type === "CATEGORY" && offer.categorySlugs.length > 0;

            return (
              <article
                key={offer.id}
                id={offer.id}
                className="relative scroll-mt-28 overflow-hidden rounded-3xl border border-border bg-surface p-8 shadow-sm"
              >
                <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-amber/10" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-danger px-2.5 py-1 text-xs font-bold text-white">
                    {offer.discountLabel || "OFFER"}
                  </span>
                  <span className="rounded-md bg-surface-muted px-2.5 py-1 text-xs font-semibold text-muted">
                    {offer.type}
                  </span>
                </div>
                <h2 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-semibold text-navy">
                  {offer.title}
                </h2>
                <p className="mt-2 text-muted">{offer.subtitle}</p>
                <p className="mt-4 text-sm font-semibold text-amber">
                  Ends {new Date(offer.endAt).toLocaleDateString()}
                </p>

                {isCombo && (
                  <div className="mt-5 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">
                      Combo includes
                    </p>
                    <ul className="space-y-2">
                      {offer.products.map((p) => (
                        <li key={p.id}>
                          <Link
                            href={`/products/${p.slug}`}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted/60 px-3 py-2 text-sm hover:border-amber/40"
                          >
                            <span className="font-semibold text-navy">
                              {p.name}
                              <span className="ml-2 text-xs font-normal text-muted">
                                {p.code}
                              </span>
                            </span>
                            <span className="font-bold text-navy">
                              {formatInr(p.offerPrice)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted">
                      Extra combo discount applies at billing when all items are
                      on the bill. Catalogue prices already show festival rates.
                    </p>
                    <AddComboButton products={offer.products} />
                  </div>
                )}

                {isCategory && (
                  <p className="mt-4 text-sm font-semibold text-navy">
                    Categories: {offer.categoryNames.join(", ")}
                  </p>
                )}

                {type === "FESTIVAL" && (
                  <p className="mt-6 text-xs text-muted">
                    Festival rates are already reflected in product offer
                    prices on the catalogue.
                  </p>
                )}

                <Link
                  href={href}
                  className="mt-6 inline-flex rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-bright"
                >
                  {isCombo
                    ? "View combo products"
                    : isCategory
                      ? "Shop these categories"
                      : "Shop products"}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
