import { prisma } from "@/lib/prisma";
import { apiOk } from "@/lib/api";

export async function GET() {
  const brands = await prisma.brand.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return apiOk({ brands });
}
