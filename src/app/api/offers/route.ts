import { prisma } from "@/lib/prisma";
import { apiOk } from "@/lib/api";
import { Prisma } from "@prisma/client";

function asIdArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

export async function GET() {
  const now = new Date();
  const offers = await prisma.offer.findMany({
    where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } },
    orderBy: { startAt: "desc" },
  });

  const catIds = [...new Set(offers.flatMap((o) => asIdArray(o.categoryIds)))];
  const prodIds = [...new Set(offers.flatMap((o) => asIdArray(o.productIds)))];

  const [cats, products] = await Promise.all([
    catIds.length > 0
      ? prisma.category.findMany({
          where: { id: { in: catIds } },
          select: { id: true, nameEn: true, slug: true },
        })
      : Promise.resolve([]),
    prodIds.length > 0
      ? prisma.product.findMany({
          where: { id: { in: prodIds } },
          select: { id: true, nameEn: true, code: true, slug: true },
        })
      : Promise.resolve([]),
  ]);

  const catById = Object.fromEntries(cats.map((c) => [c.id, c]));
  const prodById = Object.fromEntries(products.map((p) => [p.id, p]));

  return apiOk({
    offers: offers.map((o) => {
      const categoryIds = asIdArray(o.categoryIds);
      const productIds = asIdArray(o.productIds);
      const categories = categoryIds.map((id) => catById[id]).filter(Boolean);
      return {
        ...o,
        categoryIds,
        productIds,
        categories,
        categorySlugs: categories.map((c) => c.slug),
        products: productIds.map((id) => prodById[id]).filter(Boolean),
      };
    }),
  });
}
