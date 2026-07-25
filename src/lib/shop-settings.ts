import { prisma } from "@/lib/prisma";
import { DEFAULT_SHOP, type ShopSettings } from "@/lib/shop-defaults";

export type { ShopSettings };
export { DEFAULT_SHOP };

export type LoyaltyPublicSettings = {
  enabled: boolean;
  pointsPerHundred: number;
  maxDiscountPercent: number;
  maxLoyaltyDiscountAmount: number;
  minRedemptionPoints: number;
};

export const DEFAULT_LOYALTY_PUBLIC: LoyaltyPublicSettings = {
  enabled: true,
  pointsPerHundred: 1,
  maxDiscountPercent: 30,
  maxLoyaltyDiscountAmount: 5000,
  minRedemptionPoints: 1,
};

/** Avoid crashing Next.js prerender/build when SQLite tables are missing. */
function isDbUnavailable(e: unknown) {
  const code =
    e && typeof e === "object" && "code" in e
      ? String((e as { code?: string }).code)
      : "";
  return (
    code === "P2021" || // table does not exist
    code === "P1003" || // database file does not exist
    code === "P1017" ||
    code === "P1001"
  );
}

export async function getShopSettings(): Promise<ShopSettings> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: "shop" } });
    if (!row) return DEFAULT_SHOP;
    try {
      return { ...DEFAULT_SHOP, ...JSON.parse(row.value) } as ShopSettings;
    } catch {
      return DEFAULT_SHOP;
    }
  } catch (e) {
    if (isDbUnavailable(e)) return DEFAULT_SHOP;
    throw e;
  }
}

/** Public loyalty rules for earn preview + enquiry redeem caps. */
export async function getLoyaltyPublicSettings(): Promise<LoyaltyPublicSettings> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: "loyalty" } });
    if (!row) return DEFAULT_LOYALTY_PUBLIC;
    try {
      const parsed = JSON.parse(row.value) as Partial<{
        enabled: boolean;
        pointsPerHundred: number;
        maxDiscountPercent: number;
        maxLoyaltyDiscountAmount: number;
        minRedemptionPoints: number;
      }>;
      return {
        enabled: parsed.enabled !== false,
        pointsPerHundred: Math.max(0, Number(parsed.pointsPerHundred) || 0),
        maxDiscountPercent: Math.min(
          100,
          Math.max(0, Number(parsed.maxDiscountPercent) || 30)
        ),
        maxLoyaltyDiscountAmount: Math.max(
          0,
          Number(parsed.maxLoyaltyDiscountAmount) || 5000
        ),
        minRedemptionPoints: Math.max(
          0,
          Number(parsed.minRedemptionPoints) || 1
        ),
      };
    } catch {
      return DEFAULT_LOYALTY_PUBLIC;
    }
  } catch (e) {
    if (isDbUnavailable(e)) return DEFAULT_LOYALTY_PUBLIC;
    throw e;
  }
}

/** Public reviews from delivered order feedback (DB only — no mock list). */
export async function getPublicReviews(limit = 6) {
  try {
    const rows = await prisma.feedback.findMany({
      where: { allowPublicDisplay: true },
      include: {
        order: { include: { customer: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return rows.map((f) => ({
      name: f.order.customer.name || "Customer",
      city: "",
      rating: f.rating,
      text: f.comment || "Great festive experience.",
    }));
  } catch (e) {
    if (isDbUnavailable(e)) return [];
    throw e;
  }
}
