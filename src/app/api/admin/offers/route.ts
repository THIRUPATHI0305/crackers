import { ZodError } from "zod";
import { requireSession, writeAudit } from "@/lib/auth";
import { apiError, apiOk, fromZod } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { offerUpsertSchema } from "@/lib/validation";
import { Prisma } from "@prisma/client";

function asIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

async function withOfferMeta<
  T extends {
    categoryIds: Prisma.JsonValue | null;
    productIds: Prisma.JsonValue | null;
  },
>(offers: T[]) {
  const catIds = [...new Set(offers.flatMap((o) => asIdArray(o.categoryIds)))];
  const prodIds = [...new Set(offers.flatMap((o) => asIdArray(o.productIds)))];

  const [cats, products] = await Promise.all([
    catIds.length > 0
      ? prisma.category.findMany({
          where: { id: { in: catIds } },
          select: { id: true, nameEn: true, slug: true },
        })
      : Promise.resolve([]),
    prodIds.length > 0
      ? prisma.product.findMany({
          where: { id: { in: prodIds } },
          select: {
            id: true,
            nameEn: true,
            code: true,
            slug: true,
            offerPrice: true,
            category: { select: { nameEn: true, slug: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const catById = Object.fromEntries(cats.map((c) => [c.id, c]));
  const prodById = Object.fromEntries(products.map((p) => [p.id, p]));

  return offers.map((o) => {
    const categoryIds = asIdArray(o.categoryIds);
    const productIds = asIdArray(o.productIds);
    const categories = categoryIds.map((id) => catById[id]).filter(Boolean);
    const offerProducts = productIds.map((id) => prodById[id]).filter(Boolean);
    return {
      ...o,
      categoryIds,
      productIds,
      categories,
      categorySlugs: categories.map((c) => c.slug),
      products: offerProducts,
    };
  });
}

export async function GET() {
  const { error } = await requireSession(["ADMIN", "CASHIER"]);
  if (error) return apiError(error, "Forbidden", error === "FORBIDDEN" ? 403 : 401);

  const offers = await prisma.offer.findMany({
    orderBy: { startAt: "desc" },
  });
  return apiOk({ offers: await withOfferMeta(offers) });
}

export async function POST(req: Request) {
  const auth = await requireSession(["ADMIN"]);
  if (auth.error || !auth.user) {
    return apiError(auth.error || "UNAUTHORIZED", "Forbidden", 401);
  }

  try {
    const body = offerUpsertSchema.parse(await req.json());

    if (body.categoryIds.length > 0) {
      const found = await prisma.category.count({
        where: { id: { in: body.categoryIds } },
      });
      if (found !== body.categoryIds.length) {
        return apiError(
          "VALIDATION_ERROR",
          "One or more categories not found",
          400
        );
      }
    }
    if (body.productIds.length > 0) {
      const found = await prisma.product.count({
        where: { id: { in: body.productIds }, isActive: true },
      });
      if (found !== body.productIds.length) {
        return apiError(
          "VALIDATION_ERROR",
          "One or more products not found",
          400
        );
      }
    }

    const offer = await prisma.offer.create({
      data: {
        title: body.title,
        subtitle: body.subtitle || null,
        type: body.type,
        discountLabel: body.discountLabel || null,
        percentOff: body.percentOff ?? null,
        fixedOff: body.fixedOff ?? null,
        categoryIds:
          body.type === "CATEGORY" ? body.categoryIds : Prisma.JsonNull,
        productIds: body.type === "COMBO" ? body.productIds : Prisma.JsonNull,
        startAt: body.startAt,
        endAt: body.endAt,
        isActive: body.isActive,
      },
    });
    await writeAudit(auth.user.id, "OFFER_CREATE", "Offer", offer.id);
    const [enriched] = await withOfferMeta([offer]);
    return apiOk({ offer: enriched }, 201);
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    console.error(e);
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unknown argument")) {
      return apiError(
        "INTERNAL_ERROR",
        "Server schema out of date — restart npm run dev after prisma generate",
        500
      );
    }
    return apiError("INTERNAL_ERROR", "Could not create offer", 500);
  }
}

export async function PUT(req: Request) {
  const auth = await requireSession(["ADMIN"]);
  if (auth.error || !auth.user) {
    return apiError(auth.error || "UNAUTHORIZED", "Forbidden", 401);
  }

  try {
    const body = offerUpsertSchema.parse(await req.json());
    if (!body.id) return apiError("VALIDATION_ERROR", "Offer id required", 400);

    const existing = await prisma.offer.findUnique({ where: { id: body.id } });
    if (!existing) return apiError("NOT_FOUND", "Offer not found", 404);

    if (body.categoryIds.length > 0) {
      const found = await prisma.category.count({
        where: { id: { in: body.categoryIds } },
      });
      if (found !== body.categoryIds.length) {
        return apiError(
          "VALIDATION_ERROR",
          "One or more categories not found",
          400
        );
      }
    }
    if (body.productIds.length > 0) {
      const found = await prisma.product.count({
        where: { id: { in: body.productIds }, isActive: true },
      });
      if (found !== body.productIds.length) {
        return apiError(
          "VALIDATION_ERROR",
          "One or more products not found",
          400
        );
      }
    }

    const offer = await prisma.offer.update({
      where: { id: body.id },
      data: {
        title: body.title,
        subtitle: body.subtitle || null,
        type: body.type,
        discountLabel: body.discountLabel || null,
        percentOff: body.percentOff ?? null,
        fixedOff: body.fixedOff ?? null,
        categoryIds:
          body.type === "CATEGORY" ? body.categoryIds : Prisma.JsonNull,
        productIds: body.type === "COMBO" ? body.productIds : Prisma.JsonNull,
        startAt: body.startAt,
        endAt: body.endAt,
        isActive: body.isActive,
      },
    });
    await writeAudit(auth.user.id, "OFFER_UPDATE", "Offer", offer.id);
    const [enriched] = await withOfferMeta([offer]);
    return apiOk({ offer: enriched });
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    console.error(e);
    return apiError("INTERNAL_ERROR", "Could not update offer", 500);
  }
}
