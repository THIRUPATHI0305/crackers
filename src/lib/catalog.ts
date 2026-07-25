import { prisma } from "@/lib/prisma";

export async function getCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getBrands() {
  return prisma.brand.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getBrandBySlug(slug: string) {
  return prisma.brand.findFirst({
    where: { slug, isActive: true },
    include: {
      products: {
        where: { isActive: true },
        include: { category: true, brand: true },
      },
    },
  });
}

export async function getProducts(filters?: {
  brand?: string | string[];
  category?: string | string[];
  ids?: string | string[];
  q?: string;
  featured?: boolean;
  bestSeller?: boolean;
  brandedSale?: boolean;
}) {
  const brands = [filters?.brand].flat().filter(Boolean) as string[];
  const categories = [filters?.category].flat().filter(Boolean) as string[];
  const ids = [filters?.ids]
    .flat()
    .filter(Boolean)
    .flatMap((v) => String(v).split(","))
    .map((v) => v.trim())
    .filter(Boolean) as string[];
  const q = filters?.q?.trim();

  return prisma.product.findMany({
    where: {
      isActive: true,
      ...(ids.length > 0 ? { id: { in: ids } } : {}),
      ...(filters?.featured ? { isFeatured: true } : {}),
      ...(filters?.bestSeller ? { isBestSeller: true } : {}),
      ...(filters?.brandedSale ? { isBrandedSale: true } : {}),
      ...(brands.length === 1
        ? { brand: { slug: brands[0] } }
        : brands.length > 1
          ? { brand: { slug: { in: brands } } }
          : {}),
      ...(categories.length === 1
        ? { category: { slug: categories[0] } }
        : categories.length > 1
          ? { category: { slug: { in: categories } } }
          : {}),
      ...(q
        ? {
            OR: [
              { nameEn: { contains: q } },
              { nameTa: { contains: q } },
              { code: { contains: q } },
              { descriptionEn: { contains: q } },
              {
                category: {
                  nameEn: { contains: q },
                },
              },
              {
                brand: {
                  nameEn: { contains: q },
                },
              },
            ],
          }
        : {}),
    },
    include: { category: true, brand: true },
    orderBy: { nameEn: "asc" },
  });
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, isActive: true },
    include: { category: true, brand: true },
  });
}

export async function getOffers() {
  const now = new Date();
  const offers = await prisma.offer.findMany({
    where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } },
    orderBy: { startAt: "desc" },
  });
  return enrichOffers(offers);
}

function asIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

/** Resolve category + product meta for storefront / home cards */
export async function enrichOffers<
  T extends {
    id: string;
    title: string;
    subtitle: string | null;
    type: string;
    discountLabel: string | null;
    percentOff: number | null;
    fixedOff: number | null;
    categoryIds: unknown;
    productIds: unknown;
    endAt: Date;
  },
>(offers: T[]) {
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
          where: { id: { in: prodIds }, isActive: true },
          select: {
            id: true,
            slug: true,
            nameEn: true,
            code: true,
            imageUrl: true,
            originalPrice: true,
            offerPrice: true,
            stock: true,
            category: { select: { slug: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const catById = Object.fromEntries(cats.map((c) => [c.id, c]));
  const prodById = Object.fromEntries(products.map((p) => [p.id, p]));

  return offers.map((o) => {
    const categoryIds = asIdArray(o.categoryIds);
    const productIds = asIdArray(o.productIds);
    const categories = categoryIds.map((id) => catById[id]).filter(Boolean);
    const offerProducts = productIds
      .map((id) => prodById[id])
      .filter(Boolean)
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.nameEn,
        code: p.code,
        image: p.imageUrl || "/images/product-sparklers.png",
        originalPrice: p.originalPrice,
        offerPrice: p.offerPrice,
        stock: p.stock,
        categorySlug: p.category.slug,
      }));

    return {
      ...o,
      categoryIds,
      productIds,
      categorySlugs: categories.map((c) => c.slug),
      categoryNames: categories.map((c) => c.nameEn),
      products: offerProducts,
    };
  });
}

export function toUiProduct(p: Awaited<ReturnType<typeof getProducts>>[number]) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.nameEn,
    category: p.category.nameEn,
    categorySlug: p.category.slug,
    brand: p.brand?.nameEn || "",
    brandSlug: p.brand?.slug || "",
    image: p.imageUrl || "/images/product-sparklers.png",
    originalPrice: p.originalPrice,
    offerPrice: p.offerPrice,
    stock: p.stock,
    featured: p.isFeatured,
    bestSeller: p.isBestSeller,
    brandedSale: p.isBrandedSale,
    hasVideo: Boolean(p.youtubeVideoId),
    description: p.descriptionEn || "",
    code: p.code,
    safetyNote: p.safetyNoteEn || "",
  };
}
