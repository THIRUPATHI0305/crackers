import { requireSession } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession(["ADMIN"]);
  if (error) return apiError(error, "Forbidden", error === "FORBIDDEN" ? 403 : 401);

  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true, brand: true },
  });
  if (!product) return apiError("NOT_FOUND", "Product not found", 404);
  return apiOk({ product });
}
