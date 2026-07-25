import { ProductCard } from "@/components/ProductCard";
import { ProductCatalogFilters } from "@/components/ProductCatalogFilters";
import { getBrands, getCategories, getProducts, toUiProduct } from "@/lib/catalog";

function toSlugList(value?: string | string[]) {
  if (!value) return [] as string[];
  return (Array.isArray(value) ? value : [value])
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    brand?: string | string[];
    category?: string | string[];
    ids?: string | string[];
    q?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const selectedBrands = toSlugList(params.brand);
  const selectedCategories = toSlugList(params.category);
  const selectedIds = toSlugList(params.ids);
  const searchQuery = (
    Array.isArray(params.q) ? params.q[0] : params.q || ""
  ).trim();

  const [brands, categories, productsRaw] = await Promise.all([
    getBrands(),
    getCategories(),
    getProducts({
      brand: selectedBrands,
      category: selectedCategories,
      ids: selectedIds,
      q: searchQuery || undefined,
    }),
  ]);
  const products = productsRaw.map(toUiProduct);

  const titleParts = [
    ...selectedBrands.map(
      (s) => brands.find((b) => b.slug === s)?.nameEn || s
    ),
    ...selectedCategories.map(
      (s) => categories.find((c) => c.slug === s)?.nameEn || s
    ),
  ];
  const heading = searchQuery
    ? `Search: “${searchQuery}”`
    : selectedIds.length > 0
      ? "Combo / selected products"
      : titleParts.length === 0
        ? "All products"
        : titleParts.length === 1
          ? titleParts[0]
          : `${titleParts.length} filters`;

  return (
    <div className="bg-atmosphere min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber">
            Catalogue
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl font-semibold text-navy">
            {heading}
          </h1>
          <p className="mt-3 text-muted">
            Live catalogue · add to cart · confirm on WhatsApp · no online
            payment
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:gap-8">
          <ProductCatalogFilters
            brands={brands.map((b) => ({
              id: b.id,
              nameEn: b.nameEn,
              slug: b.slug,
            }))}
            categories={categories.map((c) => ({
              id: c.id,
              nameEn: c.nameEn,
              slug: c.slug,
              productCount: c.productCount,
            }))}
            selectedBrands={selectedBrands}
            selectedCategories={selectedCategories}
            resultCount={products.length}
            searchQuery={searchQuery}
          />

          <div className="min-w-0 flex-1">
            <p className="mb-4 hidden text-sm text-muted lg:block">
              Showing {products.length} product
              {products.length === 1 ? "" : "s"}
              {searchQuery ? ` for “${searchQuery}”` : ""}
              {selectedBrands.length + selectedCategories.length > 0
                ? ` · ${selectedBrands.length + selectedCategories.length} filter${
                    selectedBrands.length + selectedCategories.length === 1
                      ? ""
                      : "s"
                  }`
                : ""}
            </p>
            {products.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface p-8 text-center">
                <p className="font-semibold text-navy">No products found</p>
                <p className="mt-1 text-sm text-muted">
                  Try another search, brand, or category.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
