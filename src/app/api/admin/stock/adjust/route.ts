import { ZodError } from "zod";
import { requireSession, writeAudit } from "@/lib/auth";
import { apiError, apiOk, fromZod } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { stockAdjustSchema } from "@/lib/validation";

export async function GET() {
  const { error } = await requireSession(["ADMIN", "CASHIER"]);
  if (error) {
    return apiError(
      error,
      "Forbidden",
      error === "FORBIDDEN" ? 403 : 401
    );
  }
  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: [{ nameEn: "asc" }],
  });
  return apiOk({
    products,
    lowStock: products.filter((p) => p.stock <= p.minStock),
  });
}

export async function POST(req: Request) {
  const auth = await requireSession(["ADMIN"]);
  if (auth.error || !auth.user) return apiError(auth.error || "UNAUTHORIZED", "Forbidden", 401);

  try {
    const body = stockAdjustSchema.parse(await req.json());
    const product = await prisma.product.findUnique({ where: { id: body.productId } });
    if (!product) return apiError("NOT_FOUND", "Product not found", 404);
    if (product.stock + body.delta < 0) {
      return apiError("BUSINESS_RULE", "Stock cannot become negative", 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id: product.id },
        data: { stock: { increment: body.delta } },
      });
      await tx.stockTransaction.create({
        data: {
          productId: product.id,
          delta: body.delta,
          reason: "ADJUST",
          note: body.note,
        },
      });
      return p;
    });

    await writeAudit(auth.user.id, "STOCK_ADJUST", "Product", product.id, body);
    return apiOk({ product: updated });
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    return apiError("INTERNAL_ERROR", "Stock adjust failed", 500);
  }
}
