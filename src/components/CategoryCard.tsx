import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/lib/data";

export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      href={`/products?category=${category.slug}`}
      className="group relative block overflow-hidden rounded-2xl border border-border bg-surface transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,39,68,0.08)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-white">
        <Image
          src={category.image}
          alt={category.name}
          fill
          className="object-contain p-2 transition duration-500 group-hover:scale-[1.04]"
          sizes="(max-width:768px) 50vw, 20vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/75 via-navy/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            {category.name}
          </h3>
          <p className="mt-0.5 text-xs text-white/80">
            {category.productCount} products
          </p>
        </div>
      </div>
    </Link>
  );
}
