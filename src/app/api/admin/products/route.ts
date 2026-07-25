import { ZodError } from "zod";
import { requireSession, writeAudit } from "@/lib/auth";
import { apiError, apiOk, fromZod } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { nextProductCode } from "@/lib/product-code";
import {
  extractYoutubeId,
  productUpsertSchema,
} from "@/lib/validation";

export async function GET(req: Request) {
  const { error } = await requireSession(["ADMIN", "CASHIER"]);
  if (error) {
    return apiError(
      error,
      "Forbidden",
      error === "FORBIDDEN" ? 403 : 401
    );
  }

  const wantNext = new URL(req.url).searchParams.get("nextCode");
  if (wantNext === "1") {
    const code = await nextProductCode();
    return apiOk({ code });
  }

  const products = await prisma.product.findMany({
    include: { category: true, brand: true },
    orderBy: [{ nameEn: "asc" }],
  });
  return apiOk({ products });
}

export async function POST(req: Request) {
  const auth = await requireSession(["ADMIN"]);
  if (auth.error || !auth.user) {
    return apiError(auth.error || "UNAUTHORIZED", "Forbidden", 401);
  }

  try {
    const body = productUpsertSchema.parse(await req.json());
    const youtubeUrl = body.youtubeUrl || null;
    const youtubeVideoId = youtubeUrl ? extractYoutubeId(youtubeUrl) : null;
    const code = await nextProductCode();

    const existing = await prisma.product.findFirst({
      where: { slug: body.slug },
    });
    if (existing) {
      return apiError("CONFLICT", "Slug already exists", 409);
    }

    const category = await prisma.category.findUnique({
      where: { id: body.categoryId },
    });
    if (!category) return apiError("NOT_FOUND", "Category not found", 404);

    if (body.brandId) {
      const brand = await prisma.brand.findUnique({ where: { id: body.brandId } });
      if (!brand) return apiError("NOT_FOUND", "Brand not found", 404);
    }

    const product = await prisma.product.create({
      data: {
        nameEn: body.nameEn,
        nameTa: body.nameTa || null,
        code,
        slug: body.slug,
        categoryId: body.categoryId,
        brandId: body.brandId || null,
        descriptionEn: body.descriptionEn || null,
        descriptionTa: body.descriptionTa || null,
        safetyNoteEn: body.safetyNoteEn || null,
        safetyNoteTa: body.safetyNoteTa || null,
        originalPrice: body.originalPrice,
        offerPrice: body.offerPrice,
        stock: body.stock,
        minStock: body.minStock,
        isActive: body.isActive,
        isFeatured: body.isFeatured,
        isBestSeller: body.isBestSeller,
        isBrandedSale: body.isBrandedSale,
        imageUrl: body.imageUrl || "/images/product-sparklers.png",
        youtubeUrl,
        youtubeVideoId,
        showVideoOnCard: body.showVideoOnCard,
        showVideoOnDetails: body.showVideoOnDetails,
      },
      include: { category: true, brand: true },
    });

    await prisma.category.update({
      where: { id: body.categoryId },
      data: { productCount: { increment: 1 } },
    });

    await writeAudit(auth.user.id, "PRODUCT_CREATE", "Product", product.id);
    return apiOk({ product }, 201);
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    return apiError("INTERNAL_ERROR", "Could not create product", 500);
  }
}

export async function PUT(req: Request) {
  const auth = await requireSession(["ADMIN"]);
  if (auth.error || !auth.user) {
    return apiError(auth.error || "UNAUTHORIZED", "Forbidden", 401);
  }

  try {
    const raw = await req.json();
    const id = typeof raw?.id === "string" ? raw.id : "";
    if (!id) return apiError("VALIDATION_ERROR", "Product id required", 400);

    const body = productUpsertSchema.parse(raw);
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return apiError("NOT_FOUND", "Product not found", 404);

    const clash = await prisma.product.findFirst({
      where: {
        id: { not: id },
        slug: body.slug,
      },
    });
    if (clash) {
      return apiError("CONFLICT", "Slug already exists", 409);
    }

    const youtubeUrl = body.youtubeUrl || null;
    const youtubeVideoId = youtubeUrl ? extractYoutubeId(youtubeUrl) : null;

    const product = await prisma.$transaction(async (tx) => {
      if (existing.categoryId !== body.categoryId) {
        await tx.category.update({
          where: { id: existing.categoryId },
          data: { productCount: { decrement: 1 } },
        });
        await tx.category.update({
          where: { id: body.categoryId },
          data: { productCount: { increment: 1 } },
        });
      }
      return tx.product.update({
        where: { id },
        data: {
          nameEn: body.nameEn,
          nameTa: body.nameTa || null,
          // Product code is immutable after create
          slug: body.slug,
          categoryId: body.categoryId,
          brandId: body.brandId || null,
          descriptionEn: body.descriptionEn || null,
          descriptionTa: body.descriptionTa || null,
          safetyNoteEn: body.safetyNoteEn || null,
          safetyNoteTa: body.safetyNoteTa || null,
          originalPrice: body.originalPrice,
          offerPrice: body.offerPrice,
          stock: body.stock,
          minStock: body.minStock,
          isActive: body.isActive,
          isFeatured: body.isFeatured,
          isBestSeller: body.isBestSeller,
          isBrandedSale: body.isBrandedSale,
          imageUrl: body.imageUrl || existing.imageUrl,
          youtubeUrl,
          youtubeVideoId,
          showVideoOnCard: body.showVideoOnCard,
          showVideoOnDetails: body.showVideoOnDetails,
        },
        include: { category: true, brand: true },
      });
    });

    await writeAudit(auth.user.id, "PRODUCT_UPDATE", "Product", product.id);
    return apiOk({ product });
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    return apiError("INTERNAL_ERROR", "Could not update product", 500);
  }
}
