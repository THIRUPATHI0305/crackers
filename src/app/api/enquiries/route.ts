import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, fromZod, formatInr } from "@/lib/api";
import { assertCsrf } from "@/lib/csrf";
import { consumeOtpChallenge } from "@/lib/otp";
import { assertPhoneEmailBinding } from "@/lib/phone-email";
import { enquirySchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { enquiryWhatsApp } from "@/lib/whatsapp";
import { getLoyaltyPublicSettings, getShopSettings } from "@/lib/shop-settings";
import {
  amountNeededForMinEnquiry,
  meetsMinEnquiryAmount,
  MIN_ENQUIRY_AMOUNT,
} from "@/lib/enquiry-min";
import { computeBillingTotals } from "@/lib/billing-calc";
import { Prisma } from "@prisma/client";

function asIdArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (!csrf.ok) return apiError("FORBIDDEN", csrf.reason, 403);

  const ip = clientIp(req);
  const rl = rateLimit(`enquiry:${ip}`, 15, 60_000);
  if (!rl.ok) return apiError("RATE_LIMITED", "Too many requests", 429);

  try {
    const body = enquirySchema.parse(await req.json());
    const shop = await getShopSettings();
    const loyalty = await getLoyaltyPublicSettings();

    if (body.clientRequestId) {
      const existing = await prisma.enquiry.findUnique({
        where: { clientRequestId: body.clientRequestId },
      });
      if (existing) {
        return apiOk({
          enquiryNumber: existing.number,
          whatsappUrl: enquiryWhatsApp(
            body.name,
            existing.number,
            shop.name,
            shop.whatsapp
          ),
          reused: true,
        });
      }
    }

    const binding = await assertPhoneEmailBinding(body.phone, body.email);
    if (!binding.ok) {
      return apiError("BUSINESS_RULE", binding.message, 400);
    }

    const otp = await consumeOtpChallenge({
      challengeId: body.otpChallengeId,
      phone: body.phone,
      email: body.email,
      purpose: "ENQUIRY",
      otp: body.otp,
    });
    if (!otp.ok) {
      return apiError("VALIDATION_ERROR", otp.message, 400);
    }

    const ids = [...new Set(body.items.map((i) => i.productId))];
    const slugs = [
      ...new Set(
        body.items
          .map((i) => i.slug)
          .filter((s): s is string => Boolean(s))
      ),
    ];

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { id: { in: ids } },
          ...(slugs.length > 0 ? [{ slug: { in: slugs } }] : []),
        ],
      },
      include: { category: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const bySlug = new Map(products.map((p) => [p.slug, p]));

    const qtyByProductId = new Map<string, number>();
    const unresolved: string[] = [];
    for (const item of body.items) {
      const product =
        byId.get(item.productId) ||
        (item.slug ? bySlug.get(item.slug) : undefined);
      if (!product) {
        unresolved.push(item.slug || item.productId);
        continue;
      }
      qtyByProductId.set(
        product.id,
        (qtyByProductId.get(product.id) || 0) + item.quantity
      );
    }

    if (unresolved.length > 0 || qtyByProductId.size === 0) {
      return apiError(
        "BUSINESS_RULE",
        "One or more products in your cart are no longer available. Clear the cart and add products again.",
        400
      );
    }

    const now = new Date();
    const rawOffers = await prisma.offer.findMany({
      where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } },
    });
    const allCatIds = [
      ...new Set(rawOffers.flatMap((o) => asIdArray(o.categoryIds))),
    ];
    const cats =
      allCatIds.length > 0
        ? await prisma.category.findMany({
            where: { id: { in: allCatIds } },
            select: { id: true, slug: true },
          })
        : [];
    const slugByCatId = Object.fromEntries(cats.map((c) => [c.id, c.slug]));

    const cartItems = [...qtyByProductId.entries()].map(([productId, quantity]) => {
      const p = byId.get(productId)!;
      return {
        productId: p.id,
        name: p.nameEn,
        quantity,
        originalPrice: p.originalPrice,
        offerPrice: p.offerPrice,
        categorySlug: p.category.slug,
        categoryName: p.category.nameEn,
      };
    });

    const billingOffers = rawOffers.map((o) => ({
      type: o.type,
      title: o.title,
      percentOff: o.percentOff,
      fixedOff: o.fixedOff,
      categorySlugs: asIdArray(o.categoryIds)
        .map((id) => slugByCatId[id])
        .filter(Boolean),
      productIds: asIdArray(o.productIds),
    }));

    const totals = computeBillingTotals({
      items: cartItems,
      offers: billingOffers,
      availableLoyalty: 0,
      loyaltySettings: {
        pointsPerHundred: loyalty.pointsPerHundred,
        minRedemptionPoints: loyalty.minRedemptionPoints,
        maxDiscountPercent: loyalty.maxDiscountPercent,
        maxLoyaltyDiscountAmount: loyalty.maxLoyaltyDiscountAmount,
        enabled: loyalty.enabled,
      },
      applyLoyalty: false,
    });

    const subtotal = totals.grandTotal;

    if (!meetsMinEnquiryAmount(subtotal)) {
      const need = amountNeededForMinEnquiry(subtotal);
      return apiError(
        "BUSINESS_RULE",
        `Minimum order is ${formatInr(MIN_ENQUIRY_AMOUNT)}. Add ${formatInr(need)} more to continue.`,
        400
      );
    }

    let loyaltyRedeem = 0;
    let availablePoints = 0;
    if (loyalty.enabled && body.loyaltyRedeem > 0) {
      const account = await prisma.loyaltyAccount.findUnique({
        where: { phone: body.phone },
      });
      availablePoints = account?.availablePoints ?? 0;
      const maxByPercent = Math.floor(
        (subtotal * loyalty.maxDiscountPercent) / 100
      );
      const maxAllowed = Math.min(
        availablePoints,
        loyalty.maxLoyaltyDiscountAmount,
        maxByPercent,
        Math.floor(subtotal)
      );
      if (
        maxAllowed >= loyalty.minRedemptionPoints &&
        body.loyaltyRedeem > 0
      ) {
        loyaltyRedeem = Math.min(body.loyaltyRedeem, maxAllowed);
      }
      if (body.loyaltyRedeem > 0 && loyaltyRedeem <= 0) {
        return apiError(
          "BUSINESS_RULE",
          "Not enough loyalty points to redeem on this order.",
          400
        );
      }
    }

    const estimated = Math.max(0, subtotal - loyaltyRedeem);

    const year = new Date().getFullYear();
    const count = await prisma.enquiry.count();
    const number = `ENQ-${year}-${String(count + 1).padStart(4, "0")}`;

    const enquiry = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { phone: body.phone },
        update: {
          name: body.name,
          email: body.email,
          whatsapp: body.whatsapp,
          city: body.city,
          area: body.area || null,
          address: body.address || null,
          pincode: body.pincode || null,
          language: body.language,
        },
        create: {
          name: body.name,
          phone: body.phone,
          email: body.email,
          whatsapp: body.whatsapp,
          city: body.city,
          area: body.area || null,
          address: body.address || null,
          pincode: body.pincode || null,
          language: body.language,
        },
      });

      if (loyaltyRedeem > 0) {
        const account = await tx.loyaltyAccount.findUnique({
          where: { phone: body.phone },
        });
        if (!account || account.availablePoints < loyaltyRedeem) {
          throw new Error("LOYALTY_BALANCE");
        }
        await tx.loyaltyAccount.update({
          where: { id: account.id },
          data: {
            availablePoints: { decrement: loyaltyRedeem },
            redeemedPoints: { increment: loyaltyRedeem },
          },
        });
        await tx.loyaltyTransaction.create({
          data: {
            accountId: account.id,
            type: "REDEEMED",
            points: loyaltyRedeem,
            note: `Enquiry ${number}`,
          },
        });
      }

      return tx.enquiry.create({
        data: {
          number,
          customerId: customer.id,
          note: body.note || null,
          preferredContact: body.preferredContact,
          estimatedAmount: estimated,
          loyaltyRedeem,
          clientRequestId: body.clientRequestId,
          items: {
            create: [...qtyByProductId.entries()].map(
              ([productId, quantity]) => ({
                productId,
                quantity,
                unitPrice: byId.get(productId)!.offerPrice,
              })
            ),
          },
        },
      });
    });

    const pointsIfPaid =
      loyalty.enabled && loyalty.pointsPerHundred > 0
        ? Math.floor((estimated / 100) * loyalty.pointsPerHundred)
        : 0;

    return apiOk(
      {
        enquiryNumber: enquiry.number,
        estimatedAmount: estimated,
        loyaltyRedeem,
        pointsIfPaid,
        whatsappUrl: enquiryWhatsApp(
          body.name,
          enquiry.number,
          shop.name,
          shop.whatsapp
        ),
      },
      201
    );
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    if (e instanceof Error && e.message === "LOYALTY_BALANCE") {
      return apiError(
        "BUSINESS_RULE",
        "Loyalty points balance changed. Refresh and try again.",
        400
      );
    }
    console.error(e);
    return apiError("INTERNAL_ERROR", "Could not submit enquiry", 500);
  }
}
