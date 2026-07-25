/**
 * Copy catalogue + shop settings from local Postgres → remote (Neon).
 *
 * Usage:
 *   SOURCE_DATABASE_URL="postgresql://…localhost…" \
 *   TARGET_DATABASE_URL="postgresql://…neon…" \
 *   npx tsx scripts/sync-catalog-to-remote.ts
 *
 * Or put URLs in /tmp/db_local and /tmp/db_neon (dev helper).
 */
import { readFileSync, existsSync } from "fs";
import { PrismaClient, type Prisma } from "@prisma/client";

function loadUrl(envKey: string, fileFallback: string) {
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv) return fromEnv;
  if (existsSync(fileFallback)) {
    const v = readFileSync(fileFallback, "utf8").trim();
    if (v) return v;
  }
  throw new Error(`Missing ${envKey} (or ${fileFallback})`);
}

function client(url: string) {
  return new PrismaClient({ datasources: { db: { url } } });
}

async function main() {
  const sourceUrl = loadUrl("SOURCE_DATABASE_URL", "/tmp/db_local");
  const targetUrl = loadUrl("TARGET_DATABASE_URL", "/tmp/db_neon");

  if (sourceUrl === targetUrl) {
    throw new Error("SOURCE and TARGET database URLs must be different");
  }

  const source = client(sourceUrl);
  const target = client(targetUrl);

  try {
    const [brands, categories, products, offers, settings] = await Promise.all([
      source.brand.findMany(),
      source.category.findMany(),
      source.product.findMany(),
      source.offer.findMany(),
      source.setting.findMany(),
    ]);

    console.log("Source counts:", {
      brands: brands.length,
      categories: categories.length,
      products: products.length,
      offers: offers.length,
      settings: settings.length,
    });

    // Order matters: brands/categories → products → offers
    if (brands.length) {
      await target.brand.createMany({ data: brands, skipDuplicates: true });
    }
    if (categories.length) {
      await target.category.createMany({
        data: categories,
        skipDuplicates: true,
      });
    }

    // Upsert products by unique code (keeps same ids when possible)
    let productUpserts = 0;
    for (const p of products) {
      const { createdAt: _c, updatedAt: _u, ...data } = p;
      await target.product.upsert({
        where: { code: p.code },
        create: data,
        update: {
          slug: data.slug,
          nameEn: data.nameEn,
          nameTa: data.nameTa,
          descriptionEn: data.descriptionEn,
          descriptionTa: data.descriptionTa,
          safetyNoteEn: data.safetyNoteEn,
          safetyNoteTa: data.safetyNoteTa,
          categoryId: data.categoryId,
          brandId: data.brandId,
          originalPrice: data.originalPrice,
          offerPrice: data.offerPrice,
          stock: data.stock,
          minStock: data.minStock,
          isActive: data.isActive,
          isFeatured: data.isFeatured,
          isBestSeller: data.isBestSeller,
          isBrandedSale: data.isBrandedSale,
          imageUrl: data.imageUrl,
          youtubeUrl: data.youtubeUrl,
          youtubeVideoId: data.youtubeVideoId,
          showVideoOnCard: data.showVideoOnCard,
          showVideoOnDetails: data.showVideoOnDetails,
        },
      });
      productUpserts++;
    }

    // Remap offer productIds if product ids changed (matched by code)
    const sourceById = Object.fromEntries(products.map((p) => [p.id, p]));
    const targetProducts = await target.product.findMany({
      select: { id: true, code: true },
    });
    const targetIdByCode = Object.fromEntries(
      targetProducts.map((p) => [p.code, p.id])
    );

    function remapIds(raw: Prisma.JsonValue | null): string[] {
      if (!Array.isArray(raw)) return [];
      const out: string[] = [];
      for (const id of raw) {
        if (typeof id !== "string") continue;
        const src = sourceById[id];
        if (!src) continue;
        const mapped = targetIdByCode[src.code];
        if (mapped) out.push(mapped);
      }
      return out;
    }

    let offerUpserts = 0;
    for (const o of offers) {
      const productIds = remapIds(o.productIds);
      const categoryIds = Array.isArray(o.categoryIds)
        ? o.categoryIds.filter((v): v is string => typeof v === "string")
        : [];

      const existing = await target.offer.findFirst({
        where: { title: o.title, type: o.type },
      });

      const payload = {
        title: o.title,
        subtitle: o.subtitle,
        type: o.type,
        discountLabel: o.discountLabel,
        percentOff: o.percentOff,
        fixedOff: o.fixedOff,
        categoryIds: categoryIds.length ? categoryIds : undefined,
        productIds: productIds.length ? productIds : undefined,
        startAt: o.startAt,
        endAt: o.endAt,
        isActive: o.isActive,
      };

      if (existing) {
        await target.offer.update({
          where: { id: existing.id },
          data: payload,
        });
      } else {
        await target.offer.create({
          data: { id: o.id, ...payload },
        });
      }
      offerUpserts++;
    }

    let settingUpserts = 0;
    for (const s of settings) {
      await target.setting.upsert({
        where: { key: s.key },
        create: { key: s.key, value: s.value },
        update: { value: s.value },
      });
      settingUpserts++;
    }

    const after = {
      brands: await target.brand.count(),
      categories: await target.category.count(),
      products: await target.product.count(),
      offers: await target.offer.count(),
      settings: await target.setting.count(),
    };

    console.log("Synced:", {
      productUpserts,
      offerUpserts,
      settingUpserts,
    });
    console.log("Target counts:", after);
    console.log("Done. Refresh https://crackers-self.vercel.app");
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
