"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

type Brand = { id: string; nameEn: string; slug: string };
type Category = { id: string; nameEn: string; slug: string; productCount: number };

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function buildHref(brands: string[], categories: string[], search = "") {
  const q = new URLSearchParams();
  const term = search.trim();
  if (term) q.set("q", term);
  for (const b of brands) q.append("brand", b);
  for (const c of categories) q.append("category", c);
  const s = q.toString();
  return s ? `/products?${s}` : "/products";
}

function toggleValue(list: string[], value: string) {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

function keyOf(list: string[]) {
  return [...list].sort().join("|");
}

function FilterLists({
  brands,
  categories,
  selectedBrands,
  selectedCategories,
  onToggleBrand,
  onToggleCategory,
}: {
  brands: Brand[];
  categories: Category[];
  selectedBrands: string[];
  selectedCategories: string[];
  onToggleBrand: (slug: string) => void;
  onToggleCategory: (slug: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted">
          Brands
        </p>
        <ul className="mt-3 space-y-1">
          {brands.map((b) => {
            const checked = selectedBrands.includes(b.slug);
            return (
              <li key={b.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    checked
                      ? "bg-amber/10 font-semibold text-navy"
                      : "text-muted hover:bg-surface-muted hover:text-navy"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{b.nameEn}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleBrand(b.slug)}
                    className="h-5 w-5 shrink-0 cursor-pointer accent-amber"
                  />
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted">
          Categories
        </p>
        <ul className="mt-3 max-h-[min(55vh,28rem)] space-y-1 overflow-y-auto pr-1">
          {categories.map((c) => {
            const checked = selectedCategories.includes(c.slug);
            return (
              <li key={c.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    checked
                      ? "bg-navy/10 font-semibold text-navy"
                      : "text-muted hover:bg-surface-muted hover:text-navy"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{c.nameEn}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {c.productCount}
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleCategory(c.slug)}
                    className="h-5 w-5 shrink-0 cursor-pointer accent-navy"
                  />
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function ProductCatalogFilters({
  brands,
  categories,
  selectedBrands,
  selectedCategories,
  resultCount,
  searchQuery = "",
}: {
  brands: Brand[];
  categories: Category[];
  selectedBrands: string[];
  selectedCategories: string[];
  resultCount: number;
  searchQuery?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  /** Optimistic selection — updates on first click, then syncs URL */
  const [liveBrands, setLiveBrands] = useState(selectedBrands);
  const [liveCategories, setLiveCategories] = useState(selectedCategories);
  const [draftBrands, setDraftBrands] = useState(selectedBrands);
  const [draftCategories, setDraftCategories] = useState(selectedCategories);

  const brandsRef = useRef(liveBrands);
  const categoriesRef = useRef(liveCategories);
  brandsRef.current = liveBrands;
  categoriesRef.current = liveCategories;
  const searchRef = useRef(searchQuery);
  searchRef.current = searchQuery;

  const propsKey = `${keyOf(selectedBrands)}::${keyOf(selectedCategories)}`;
  const liveKey = `${keyOf(liveBrands)}::${keyOf(liveCategories)}`;

  useEffect(() => {
    if (propsKey === liveKey) return;
    setLiveBrands(selectedBrands);
    setLiveCategories(selectedCategories);
    if (!open) {
      setDraftBrands(selectedBrands);
      setDraftCategories(selectedCategories);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when URL props change
  }, [propsKey]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const filterCount = liveBrands.length + liveCategories.length;

  const summary = useMemo(() => {
    const brandNames = liveBrands
      .map((s) => brands.find((b) => b.slug === s)?.nameEn || s)
      .filter(Boolean);
    const categoryNames = liveCategories
      .map((s) => categories.find((c) => c.slug === s)?.nameEn || s)
      .filter(Boolean);
    const parts = [...brandNames, ...categoryNames];
    if (parts.length === 0) return "All products";
    if (parts.length <= 2) return parts.join(" · ");
    return `${parts.slice(0, 2).join(" · ")} +${parts.length - 2}`;
  }, [brands, categories, liveBrands, liveCategories]);

  function navigate(nextBrands: string[], nextCategories: string[]) {
    startTransition(() => {
      router.replace(
        buildHref(nextBrands, nextCategories, searchRef.current),
        { scroll: false }
      );
    });
  }

  function toggleBrandLive(slug: string) {
    const next = toggleValue(brandsRef.current, slug);
    setLiveBrands(next);
    navigate(next, categoriesRef.current);
  }

  function toggleCategoryLive(slug: string) {
    const next = toggleValue(categoriesRef.current, slug);
    setLiveCategories(next);
    navigate(brandsRef.current, next);
  }

  function removeBrand(slug: string) {
    const next = liveBrands.filter((b) => b !== slug);
    setLiveBrands(next);
    navigate(next, liveCategories);
  }

  function removeCategory(slug: string) {
    const next = liveCategories.filter((c) => c !== slug);
    setLiveCategories(next);
    navigate(liveBrands, next);
  }

  function clearAll() {
    setLiveBrands([]);
    setLiveCategories([]);
    setDraftBrands([]);
    setDraftCategories([]);
    navigate([], []);
    setOpen(false);
  }

  function applyDraft() {
    setLiveBrands(draftBrands);
    setLiveCategories(draftCategories);
    navigate(draftBrands, draftCategories);
    setOpen(false);
  }

  return (
    <>
      {/* Mobile toolbar: count left, filter icon right */}
      <div className="lg:hidden">
        <div className="sticky top-28 z-30 -mx-4 border-y border-border bg-surface/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Catalogue
              </p>
              <p className="truncate text-sm font-semibold text-navy">
                {resultCount} products · {summary}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDraftBrands(liveBrands);
                setDraftCategories(liveCategories);
                setOpen(true);
              }}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-navy text-white shadow-sm"
              aria-label="Open filters"
            >
              <FilterIcon className="h-5 w-5" />
              {filterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber px-1 text-[10px] font-bold text-white">
                  {filterCount}
                </span>
              )}
            </button>
          </div>

          {filterCount > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {liveBrands.map((slug) => (
                <button
                  key={`b-${slug}`}
                  type="button"
                  onClick={() => removeBrand(slug)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber/15 px-3 py-1 text-xs font-semibold text-amber"
                >
                  {brands.find((b) => b.slug === slug)?.nameEn || slug}
                  <span aria-hidden>×</span>
                </button>
              ))}
              {liveCategories.map((slug) => (
                <button
                  key={`c-${slug}`}
                  type="button"
                  onClick={() => removeCategory(slug)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-navy/10 px-3 py-1 text-xs font-semibold text-navy"
                >
                  {categories.find((c) => c.slug === slug)?.nameEn || slug}
                  <span aria-hidden>×</span>
                </button>
              ))}
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close filters"
              className="absolute inset-0 bg-navy/40"
              onClick={() => setOpen(false)}
            />
            <div
              className="absolute inset-x-0 bottom-0 z-10 flex max-h-[88vh] flex-col overflow-hidden rounded-t-3xl border border-border bg-surface shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white">
                    <FilterIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-navy">
                      Filters
                    </p>
                    <p className="text-xs text-muted">
                      Select multiple ·{" "}
                      {draftBrands.length + draftCategories.length} selected
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-navy"
                >
                  Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                <FilterLists
                  brands={brands}
                  categories={categories}
                  selectedBrands={draftBrands}
                  selectedCategories={draftCategories}
                  onToggleBrand={(slug) =>
                    setDraftBrands((prev) => toggleValue(prev, slug))
                  }
                  onToggleCategory={(slug) =>
                    setDraftCategories((prev) => toggleValue(prev, slug))
                  }
                />
              </div>

              <div className="flex gap-3 border-t border-border bg-surface px-5 py-4">
                <button
                  type="button"
                  onClick={clearAll}
                  className="flex-1 rounded-full border border-border py-3 text-sm font-semibold text-navy"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={applyDraft}
                  className="flex-[1.4] rounded-full bg-amber py-3 text-sm font-bold text-white"
                >
                  Show results
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Laptop+: left sticky sidebar */}
      <aside className="hidden w-72 shrink-0 lg:block">
        <div className="sticky top-24 rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-navy">
                Filters
              </p>
              <p className="mt-1 text-xs text-muted">
                Multi-select · {filterCount} active
              </p>
            </div>
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white">
              <FilterIcon className="h-5 w-5" />
              {filterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber px-1 text-[10px] font-bold">
                  {filterCount}
                </span>
              )}
            </span>
          </div>

          <div className="mt-5">
            <FilterLists
              brands={brands}
              categories={categories}
              selectedBrands={liveBrands}
              selectedCategories={liveCategories}
              onToggleBrand={toggleBrandLive}
              onToggleCategory={toggleCategoryLive}
            />
          </div>

          {filterCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="mt-5 w-full rounded-full border border-border py-2.5 text-sm font-semibold text-navy hover:bg-surface-muted"
            >
              Clear all filters
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
