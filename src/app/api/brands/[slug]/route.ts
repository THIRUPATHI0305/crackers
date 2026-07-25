import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const brand = await prisma.brand.findFirst({
    where: { slug, isActive: true },
    include: {
      products: { where: { isActive: true }, orderBy: { nameEn: "asc" } },
    },
  });
  if (!brand) return apiError("NOT_FOUND", "Brand not found", 404);
  return apiOk({ brand });
}
