import { prisma } from "@/lib/prisma";
import { apiOk } from "@/lib/api";

export async function GET() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return apiOk({ categories });
}
