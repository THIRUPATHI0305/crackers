import { ZodError } from "zod";
import { requireSession, writeAudit } from "@/lib/auth";
import { apiError, apiOk, fromZod } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { brandUpsertSchema } from "@/lib/validation";
import { z } from "zod";

export async function GET() {
  const { error } = await requireSession(["ADMIN", "CASHIER"]);
  if (error) {
    return apiError(
      error,
      "Forbidden",
      error === "FORBIDDEN" ? 403 : 401
    );
  }

  const brands = await prisma.brand.findMany({
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    include: { _count: { select: { products: true } } },
  });
  return apiOk({
    brands: brands.map(({ _count, ...b }) => ({
      ...b,
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
    const body = brandUpsertSchema.parse(await req.json());
    const clash = await prisma.brand.findUnique({ where: { slug: body.slug } });
    if (clash) return apiError("CONFLICT", "Slug already exists", 409);

    const brand = await prisma.brand.create({
      data: {
        nameEn: body.nameEn,
        nameTa: body.nameTa || null,
        slug: body.slug,
        taglineEn: body.taglineEn || null,
        taglineTa: body.taglineTa || null,
        saleLabel: body.saleLabel || null,
        accent: body.accent || "#0f2744",
        imageUrl: body.imageUrl || "/images/product-giftbox.png",
        sortOrder: body.sortOrder,
        isActive: body.isActive,
      },
    });
    await writeAudit(auth.user.id, "BRAND_CREATE", "Brand", brand.id);
    return apiOk({ brand }, 201);
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    console.error(e);
    return apiError("INTERNAL_ERROR", "Could not create brand", 500);
  }
}

export async function PUT(req: Request) {
  const auth = await requireSession(["ADMIN"]);
  if (auth.error || !auth.user) {
    return apiError(auth.error || "UNAUTHORIZED", "Forbidden", 401);
  }

  try {
    const body = brandUpsertSchema.parse(await req.json());
    if (!body.id) return apiError("VALIDATION_ERROR", "Brand id required", 400);

    const existing = await prisma.brand.findUnique({ where: { id: body.id } });
    if (!existing) return apiError("NOT_FOUND", "Brand not found", 404);

    const clash = await prisma.brand.findFirst({
      where: { slug: body.slug, id: { not: body.id } },
    });
    if (clash) return apiError("CONFLICT", "Slug already exists", 409);

    const brand = await prisma.brand.update({
      where: { id: body.id },
      data: {
        nameEn: body.nameEn,
        nameTa: body.nameTa || null,
        slug: body.slug,
        taglineEn: body.taglineEn || null,
        taglineTa: body.taglineTa || null,
        saleLabel: body.saleLabel || null,
        accent: body.accent || existing.accent,
        imageUrl: body.imageUrl || existing.imageUrl,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
      },
    });
    await writeAudit(auth.user.id, "BRAND_UPDATE", "Brand", brand.id);
    return apiOk({ brand });
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    console.error(e);
    return apiError("INTERNAL_ERROR", "Could not update brand", 500);
  }
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: Request) {
  const auth = await requireSession(["ADMIN"]);
  if (auth.error || !auth.user) {
    return apiError(auth.error || "UNAUTHORIZED", "Forbidden", 401);
  }

  try {
    const body = deleteSchema.parse(await req.json());
    const existing = await prisma.brand.findUnique({ where: { id: body.id } });
    if (!existing) return apiError("NOT_FOUND", "Brand not found", 404);

    await prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: { brandId: body.id },
        data: { brandId: null },
      });
      await tx.brand.delete({ where: { id: body.id } });
    });

    await writeAudit(auth.user.id, "BRAND_DELETE", "Brand", body.id, {
      slug: existing.slug,
    });
    return apiOk({ deleted: true });
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    console.error(e);
    return apiError("INTERNAL_ERROR", "Could not delete brand", 500);
  }
}
