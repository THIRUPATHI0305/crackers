import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: { category: true, brand: true },
  });
  if (!product) return apiError("NOT_FOUND", "Product not found", 404);

  const related = await prisma.product.findMany({
    where: {
      isActive: true,
      categoryId: product.categoryId,
      NOT: { id: product.id },
    },
    take: 4,
    include: { brand: true, category: true },
  });

  return apiOk({ product, related });
}
