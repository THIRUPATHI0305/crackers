import { prisma } from "@/lib/prisma";
import { apiOk } from "@/lib/api";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || undefined;
  const brand = searchParams.get("brand") || undefined;
  const q = searchParams.get("q") || undefined;
  const brandedSale = searchParams.get("brandedSale") === "true";
  const inStock = searchParams.get("inStock") !== "false";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(
    500,
    Math.max(1, Number(searchParams.get("pageSize") || 20))
  );
  const sort = searchParams.get("sort") || "newest";

  const where: {
    isActive: boolean;
    isBrandedSale?: boolean;
    stock?: { gt: number };
    category?: { slug: string };
    brand?: { slug: string };
    OR?: Array<Record<string, unknown>>;
  } = { isActive: true };

  if (category) where.category = { slug: category };
  if (brand) where.brand = { slug: brand };
  if (brandedSale) where.isBrandedSale = true;
  if (inStock) where.stock = { gt: 0 };
  if (q) {
    where.OR = [
      { nameEn: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { descriptionEn: { contains: q, mode: "insensitive" } },
    ];
  }

  let orderBy: Record<string, string> = { createdAt: "desc" };
  if (sort === "price_asc") orderBy = { offerPrice: "asc" };
  if (sort === "price_desc") orderBy = { offerPrice: "desc" };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: { category: true, brand: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return apiOk({ products, total, page, pageSize });
}
