import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import {
  ProductDetailBreadcrumb,
  ProductDetailInfo,
  ProductDetailMedia,
  RelatedHeading,
} from "@/components/ProductDetailInfo";
import {
  getProductBySlug,
  getProducts,
  toUiProduct,
} from "@/lib/catalog";
import { discountPercent } from "@/lib/data";

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
        <ProductDetailBreadcrumb product={product} />

        <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] xl:grid-cols-[minmax(0,26rem)_1fr]">
          <ProductDetailMedia product={product} discount={discount} />
          <ProductDetailInfo product={product} />
        </div>

        {related.length > 0 && (
          <section className="mt-10 border-t border-border pt-8">
            <RelatedHeading />
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
