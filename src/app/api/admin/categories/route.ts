import { ZodError } from "zod";
import { requireSession, writeAudit } from "@/lib/auth";
import { apiError, apiOk, fromZod } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { categoryUpsertSchema } from "@/lib/validation";

export async function GET() {
  const { error } = await requireSession(["ADMIN", "CASHIER"]);
  if (error) {
    return apiError(
      error,
      "Forbidden",
      error === "FORBIDDEN" ? 403 : 401
    );
  }

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    include: { _count: { select: { products: true } } },
  });
  return apiOk({
    categories: categories.map(({ _count, ...c }) => ({
      ...c,
      productCount: _count.products,
    })),
  });
}

export async function POST(req: Request) {
  const auth = await requireSession(["ADMIN"]);
  if (auth.error || !auth.user) {
    return apiError(auth.error || "UNAUTHORIZED", "Forbidden", 401);
  }

  try {
    const body = categoryUpsertSchema.parse(await req.json());
    const clash = await prisma.category.findUnique({ where: { slug: body.slug } });
    if (clash) return apiError("CONFLICT", "Slug already exists", 409);

    const category = await prisma.category.create({
      data: {
        nameEn: body.nameEn,
        nameTa: body.nameTa || null,
        slug: body.slug,
        description: body.description || null,
        imageUrl: body.imageUrl || "/images/category-green.png",
        sortOrder: body.sortOrder,
        isActive: body.isActive,
      },
    });
    await writeAudit(auth.user.id, "CATEGORY_CREATE", "Category", category.id);
    return apiOk({ category }, 201);
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    return apiError("INTERNAL_ERROR", "Could not create category", 500);
  }
}

export async function PUT(req: Request) {
  const auth = await requireSession(["ADMIN"]);
  if (auth.error || !auth.user) {
    return apiError(auth.error || "UNAUTHORIZED", "Forbidden", 401);
  }

  try {
    const body = categoryUpsertSchema.parse(await req.json());
    if (!body.id) return apiError("VALIDATION_ERROR", "Category id required", 400);

    const existing = await prisma.category.findUnique({ where: { id: body.id } });
    if (!existing) return apiError("NOT_FOUND", "Category not found", 404);

    const clash = await prisma.category.findFirst({
      where: { slug: body.slug, id: { not: body.id } },
    });
    if (clash) return apiError("CONFLICT", "Slug already exists", 409);

    const category = await prisma.category.update({
      where: { id: body.id },
      data: {
        nameEn: body.nameEn,
        nameTa: body.nameTa || null,
        slug: body.slug,
        description: body.description || null,
        imageUrl: body.imageUrl || existing.imageUrl,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
      },
    });
    await writeAudit(auth.user.id, "CATEGORY_UPDATE", "Category", category.id);
    return apiOk({ category });
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    return apiError("INTERNAL_ERROR", "Could not update category", 500);
  }
}
