import { ZodError } from "zod";
import { randomBytes } from "crypto";
import { requireSession, writeAudit } from "@/lib/auth";
import { apiError, apiOk, fromZod } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { billingSchema } from "@/lib/validation";
import { invoiceWhatsApp } from "@/lib/whatsapp";
import { scheduleShopNewInvoice } from "@/lib/shop-notify";
import { computeBillingTotals, type BillingOffer } from "@/lib/billing-calc";
import { getShopSettings } from "@/lib/shop-settings";
import type { Prisma } from "@prisma/client";

function asIdArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

async function billingOffersFromDb(
  offers: {
    type: string;
    title: string;
    percentOff: number | null;
    fixedOff: number | null;
    categoryIds: Prisma.JsonValue | null;
    productIds?: Prisma.JsonValue | null;
  }[]
): Promise<BillingOffer[]> {
  const allIds = [...new Set(offers.flatMap((o) => asIdArray(o.categoryIds)))];
  const cats =
    allIds.length > 0
      ? await prisma.category.findMany({
          where: { id: { in: allIds } },
          select: { id: true, slug: true },
        })
      : [];
  const slugById = Object.fromEntries(cats.map((c) => [c.id, c.slug]));
  return offers.map((o) => ({
    type: o.type,
    title: o.title,
    percentOff: o.percentOff,
    fixedOff: o.fixedOff,
    categorySlugs: asIdArray(o.categoryIds)
      .map((id) => slugById[id])
      .filter(Boolean),
    productIds: asIdArray(o.productIds),
  }));
}

export async function GET(req: Request) {
  const { error } = await requireSession(["ADMIN", "CASHIER"]);
  if (error) return apiError(error, "Forbidden", error === "FORBIDDEN" ? 403 : 401);

  const q = new URL(req.url).searchParams.get("q") || undefined;
  const invoices = await prisma.invoice.findMany({
    where: {
      cancelledAt: null,
      OR: q
        ? [
            { number: { contains: q } },
            { customerPhone: { contains: q.replace(/\D/g, "") } },
            { customerName: { contains: q } },
            { order: { number: { contains: q } } },
            { enquiry: { number: { contains: q } } },
          ]
        : undefined,
    },
    include: {
      order: { select: { id: true, number: true } },
      enquiry: { select: { id: true, number: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return apiOk({ invoices });
}

export async function POST(req: Request) {
  const auth = await requireSession(["ADMIN", "CASHIER"]);
  if (auth.error || !auth.user) {
    return apiError(auth.error || "UNAUTHORIZED", "Forbidden", 401);
  }

  try {
    const body = billingSchema.parse(await req.json());

    if (body.idempotencyKey) {
      const existing = await prisma.invoice.findUnique({
        where: { idempotencyKey: body.idempotencyKey },
        include: {
          order: { select: { number: true } },
          enquiry: { select: { number: true } },
        },
      });
      if (existing) {
        const shop = await getShopSettings();
        const orderNumber = existing.order?.number || null;
        const enquiryNumber = existing.enquiry?.number || null;
        return apiOk({
          invoice: existing,
          orderNumber,
          enquiryNumber,
          whatsappUrl: invoiceWhatsApp({
            name: existing.customerName || "Customer",
            invoiceNumber: existing.number,
            total: existing.grandTotal,
            token: existing.publicToken,
            shopName: shop.name,
            customerPhone: existing.customerPhone || undefined,
            shopWhatsapp: shop.whatsapp,
            upiId: shop.upiId || undefined,
            orderNumber: orderNumber || undefined,
            enquiryNumber: enquiryNumber || undefined,
          }),
          reused: true,
        });
      }
    }

    /** Edit existing invoice — keep INV number + publicToken so customer WA link stays valid */
    if (body.invoiceId) {
      const now = new Date();
      const [offers, loyaltySettingsRow] = await Promise.all([
        prisma.offer.findMany({
          where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } },
        }),
        prisma.setting.findUnique({ where: { key: "loyalty" } }),
      ]);
      let loyaltySettings = {
        pointsPerHundred: 1,
        minRedemptionPoints: 1,
        maxDiscountPercent: 30,
        maxLoyaltyDiscountAmount: 5000,
        enabled: true,
      };
      if (loyaltySettingsRow) {
        try {
          loyaltySettings = {
            ...loyaltySettings,
            ...JSON.parse(loyaltySettingsRow.value),
          };
          if (loyaltySettings.minRedemptionPoints > 1) {
            loyaltySettings.minRedemptionPoints = 1;
          }
        } catch {
          /* keep defaults */
        }
      }

      const billingOffers = await billingOffersFromDb(offers);

      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.invoice.findUnique({
          where: { id: body.invoiceId },
          include: {
            items: true,
            order: { select: { id: true, number: true } },
            enquiry: { select: { id: true, number: true } },
          },
        });
        if (!existing || existing.cancelledAt) {
          throw new Error("INVOICE_NOT_FOUND");
        }

        // Restore stock from previous lines
        for (const old of existing.items) {
          await tx.product.update({
            where: { id: old.productId },
            data: { stock: { increment: old.quantity } },
          });
          await tx.stockTransaction.create({
            data: {
              productId: old.productId,
              delta: old.quantity,
              reason: "BILLING_EDIT",
              note: `${existing.number} restore`,
            },
          });
        }

        // Reverse prior loyalty redeem
        if (existing.customerPhone && existing.loyaltyRedeem > 0) {
          const account = await tx.loyaltyAccount.findUnique({
            where: { phone: existing.customerPhone },
          });
          if (account) {
            await tx.loyaltyAccount.update({
              where: { id: account.id },
              data: {
                availablePoints: { increment: existing.loyaltyRedeem },
                redeemedPoints: { decrement: existing.loyaltyRedeem },
              },
            });
            await tx.loyaltyTransaction.create({
              data: {
                accountId: account.id,
                type: "ADJUST",
                points: existing.loyaltyRedeem,
                note: `${existing.number} edit restore redeem`,
              },
            });
          }
        }

        // Reverse prior earn for this invoice number (not enquiry-paid notes)
        if (existing.customerPhone && existing.pointsEarned > 0) {
          const earnTx = await tx.loyaltyTransaction.findFirst({
            where: {
              type: "EARNED",
              note: existing.number,
              account: { phone: existing.customerPhone },
            },
            orderBy: { createdAt: "desc" },
          });
          if (earnTx) {
            await tx.loyaltyAccount.update({
              where: { id: earnTx.accountId },
              data: {
                availablePoints: { decrement: earnTx.points },
                earnedPoints: { decrement: earnTx.points },
              },
            });
            await tx.loyaltyTransaction.create({
              data: {
                accountId: earnTx.accountId,
                type: "ADJUST",
                points: -earnTx.points,
                note: `${existing.number} edit reverse earn`,
              },
            });
          }
        }

        const products = await tx.product.findMany({
          where: {
            id: { in: body.items.map((i) => i.productId) },
            isActive: true,
          },
          include: { category: true },
        });
        if (products.length !== body.items.length) {
          throw new Error("PRODUCT_UNAVAILABLE");
        }
        const map = Object.fromEntries(products.map((p) => [p.id, p]));
        const cartItems = body.items.map((item) => {
          const p = map[item.productId];
          if (item.quantity > p.stock) throw new Error("INSUFFICIENT_STOCK");
          return {
            productId: p.id,
            name: p.nameEn,
            quantity: item.quantity,
            originalPrice: p.originalPrice,
            offerPrice: p.offerPrice,
            categorySlug: p.category.slug,
            categoryName: p.category.nameEn,
          };
        });

        let availableLoyalty = 0;
        if (body.customerPhone && loyaltySettings.enabled) {
          const account = await tx.loyaltyAccount.findUnique({
            where: { phone: body.customerPhone },
          });
          availableLoyalty = account?.availablePoints ?? 0;
        }

        const totals = computeBillingTotals({
          items: cartItems,
          offers: billingOffers,
          availableLoyalty,
          loyaltySettings,
          applyLoyalty: body.loyaltyRedeem > 0 || body.autoLoyalty === true,
          requestedLoyalty: body.loyaltyRedeem,
        });

        const lines = cartItems.map((c) => ({
          productId: c.productId,
          name: c.name,
          quantity: c.quantity,
          unitPrice: c.offerPrice,
          lineTotal: c.offerPrice * c.quantity,
        }));

        let customerId = existing.customerId || undefined;
        if (body.customerPhone) {
          const customer = await tx.customer.upsert({
            where: { phone: body.customerPhone },
            update: { name: body.customerName },
            create: {
              phone: body.customerPhone,
              name: body.customerName,
              whatsapp: body.customerPhone,
            },
          });
          customerId = customer.id;

          if (totals.loyaltyRedeem > 0) {
            const account = await tx.loyaltyAccount.findUnique({
              where: { phone: body.customerPhone },
            });
            if (!account || account.availablePoints < totals.loyaltyRedeem) {
              throw new Error("LOYALTY_BALANCE");
            }
            await tx.loyaltyAccount.update({
              where: { id: account.id },
              data: {
                availablePoints: { decrement: totals.loyaltyRedeem },
                redeemedPoints: { increment: totals.loyaltyRedeem },
              },
            });
            await tx.loyaltyTransaction.create({
              data: {
                accountId: account.id,
                type: "REDEEMED",
                points: totals.loyaltyRedeem,
                note: `${existing.number} edit redeem`,
              },
            });
          }
        }

        let pointsEarned =
          body.awardPoints === false ? 0 : totals.pointsEarned;
        const enquiryNumber = existing.enquiry?.number || null;
        if (enquiryNumber) {
          const prior = await tx.loyaltyTransaction.findFirst({
            where: {
              type: "EARNED",
              note: `ENQUIRY_PAID:${enquiryNumber}`,
            },
          });
          if (prior) pointsEarned = 0;
        }

        await tx.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });

        const paidAmount =
          body.awardPoints === false
            ? Math.max(0, Number(body.paidAmount) || 0)
            : body.paidAmount > 0
              ? body.paidAmount
              : totals.grandTotal;

        const invoice = await tx.invoice.update({
          where: { id: existing.id },
          data: {
            customerId,
            customerName: body.customerName,
            customerPhone: body.customerPhone,
            subtotal: totals.mrpSubtotal,
            billDiscount: totals.offerDiscount,
            loyaltyRedeem: totals.loyaltyRedeem,
            grandTotal: totals.grandTotal,
            paidAmount,
            balanceAmount: Math.max(0, totals.grandTotal - paidAmount),
            paymentMethod: body.paymentMethod,
            pointsEarned,
            items: { create: lines },
          },
          include: {
            items: true,
            order: { select: { id: true, number: true } },
            enquiry: { select: { id: true, number: true } },
          },
        });

        for (const line of lines) {
          await tx.product.update({
            where: { id: line.productId },
            data: { stock: { decrement: line.quantity } },
          });
          await tx.stockTransaction.create({
            data: {
              productId: line.productId,
              delta: -line.quantity,
              reason: "BILLING",
              note: `${invoice.number} edit`,
            },
          });
        }

        if (body.customerPhone && pointsEarned > 0) {
          const account = await tx.loyaltyAccount.upsert({
            where: { phone: body.customerPhone },
            update: {
              availablePoints: { increment: pointsEarned },
              earnedPoints: { increment: pointsEarned },
            },
            create: {
              phone: body.customerPhone,
              customerId: customerId!,
              availablePoints: pointsEarned,
              earnedPoints: pointsEarned,
            },
          });
          await tx.loyaltyTransaction.create({
            data: {
              accountId: account.id,
              type: "EARNED",
              points: pointsEarned,
              note: invoice.number,
            },
          });
        }

        if (invoice.orderId) {
          await tx.order.update({
            where: { id: invoice.orderId },
            data: { amount: totals.grandTotal },
          });
        }

        return {
          invoice,
          totals: { ...totals, pointsEarned },
          orderNumber: invoice.order?.number || null,
          enquiryNumber: invoice.enquiry?.number || null,
        };
      });

      await writeAudit(auth.user.id, "INVOICE_UPDATE", "Invoice", result.invoice.id, {
        number: result.invoice.number,
        total: result.invoice.grandTotal,
        order: result.orderNumber,
      });

      const shop = await getShopSettings();
      return apiOk({
        invoice: result.invoice,
        totals: result.totals,
        orderNumber: result.orderNumber,
        enquiryNumber: result.enquiryNumber,
        updated: true,
        whatsappUrl: invoiceWhatsApp({
          name: result.invoice.customerName || "Customer",
          invoiceNumber: result.invoice.number,
          total: result.invoice.grandTotal,
          token: result.invoice.publicToken,
          shopName: shop.name,
          customerPhone: result.invoice.customerPhone || undefined,
          shopWhatsapp: shop.whatsapp,
          upiId: shop.upiId || undefined,
          orderNumber: result.orderNumber || undefined,
          enquiryNumber: result.enquiryNumber || undefined,
        }),
      });
    }

    const now = new Date();
    const [offers, loyaltySettingsRow] = await Promise.all([
      prisma.offer.findMany({
        where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } },
      }),
      prisma.setting.findUnique({ where: { key: "loyalty" } }),
    ]);

    let loyaltySettings = {
      pointsPerHundred: 1,
      minRedemptionPoints: 1,
      maxDiscountPercent: 30,
      maxLoyaltyDiscountAmount: 5000,
      enabled: true,
    };
    if (loyaltySettingsRow) {
      try {
        loyaltySettings = { ...loyaltySettings, ...JSON.parse(loyaltySettingsRow.value) };
        if (loyaltySettings.minRedemptionPoints > 1) {
          loyaltySettings.minRedemptionPoints = 1;
        }
      } catch {
        /* keep defaults */
      }
    }

    const billingOffers = await billingOffersFromDb(offers);

    const result = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: body.items.map((i) => i.productId) }, isActive: true },
        include: { category: true },
      });
      if (products.length !== body.items.length) {
        throw new Error("PRODUCT_UNAVAILABLE");
      }

      const map = Object.fromEntries(products.map((p) => [p.id, p]));
      const cartItems = body.items.map((item) => {
        const p = map[item.productId];
        if (item.quantity > p.stock) throw new Error("INSUFFICIENT_STOCK");
        return {
          productId: p.id,
          name: p.nameEn,
          quantity: item.quantity,
          originalPrice: p.originalPrice,
          offerPrice: p.offerPrice,
          categorySlug: p.category.slug,
          categoryName: p.category.nameEn,
        };
      });

      let availableLoyalty = 0;
      if (body.customerPhone && loyaltySettings.enabled) {
        const account = await tx.loyaltyAccount.findUnique({
          where: { phone: body.customerPhone },
        });
        availableLoyalty = account?.availablePoints ?? 0;
      }

      const totals = computeBillingTotals({
        items: cartItems,
        offers: billingOffers,
        availableLoyalty,
        loyaltySettings,
        applyLoyalty: body.loyaltyRedeem > 0 || body.autoLoyalty === true,
        requestedLoyalty: body.loyaltyRedeem,
      });

      const lines = cartItems.map((c) => ({
        productId: c.productId,
        name: c.name,
        quantity: c.quantity,
        unitPrice: c.offerPrice,
        lineTotal: c.offerPrice * c.quantity,
      }));

      let customerId: string | undefined;
      if (body.customerPhone) {
        const customer = await tx.customer.upsert({
          where: { phone: body.customerPhone },
          update: { name: body.customerName },
          create: {
            phone: body.customerPhone,
            name: body.customerName,
            whatsapp: body.customerPhone,
          },
        });
        customerId = customer.id;

        if (totals.loyaltyRedeem > 0) {
          const account = await tx.loyaltyAccount.findUnique({
            where: { phone: body.customerPhone },
          });
          if (!account || account.availablePoints < totals.loyaltyRedeem) {
            throw new Error("LOYALTY_BALANCE");
          }
          await tx.loyaltyAccount.update({
            where: { id: account.id },
            data: {
              availablePoints: { decrement: totals.loyaltyRedeem },
              redeemedPoints: { increment: totals.loyaltyRedeem },
            },
          });
          await tx.loyaltyTransaction.create({
            data: {
              accountId: account.id,
              type: "REDEEMED",
              points: totals.loyaltyRedeem,
              note: "Billing redemption",
            },
          });
        }
      }

      const year = new Date().getFullYear();
      const count = await tx.invoice.count();
      const number = `INV-${year}-${String(count + 1).padStart(4, "0")}`;
      const publicToken = randomBytes(16).toString("hex");
      const paidAmount =
        body.awardPoints === false
          ? Math.max(0, Number(body.paidAmount) || 0)
          : body.paidAmount > 0
            ? body.paidAmount
            : totals.grandTotal;

      /** Paid → earn pts for next bill; unpaid / already credited enquiry → 0 */
      let pointsEarned =
        body.awardPoints === false ? 0 : totals.pointsEarned;
      let enquiryNumberForLoyalty: string | null = null;
      let linkedEnquiryId: string | null = null;
      let linkedOrderId: string | null = null;
      let linkedOrderNumber: string | null = null;
      let linkedEnquiryNumber: string | null = null;

      if (body.enquiryId) {
        const enq = await tx.enquiry.findUnique({
          where: { id: body.enquiryId },
          include: { items: true, order: true, invoice: true },
        });
        if (!enq) throw new Error("ENQUIRY_NOT_FOUND");
        if (enq.invoice) throw new Error("ENQUIRY_ALREADY_INVOICED");

        linkedEnquiryId = enq.id;
        linkedEnquiryNumber = enq.number;
        enquiryNumberForLoyalty = enq.number;

        let order = enq.order;
        if (!order) {
          const oYear = new Date().getFullYear();
          const oCount = await tx.order.count();
          const oNumber = `ORD-${oYear}-${String(oCount + 1).padStart(4, "0")}`;
          order = await tx.order.create({
            data: {
              number: oNumber,
              enquiryId: enq.id,
              customerId: enq.customerId,
              status: "ORDER_CONFIRMED",
              amount: totals.grandTotal,
              customerNote: enq.note,
              items: {
                create: enq.items.map((i) => ({
                  productId: i.productId,
                  quantity: i.quantity,
                  unitPrice: i.unitPrice,
                })),
              },
              history: {
                create: [
                  {
                    status: "ENQUIRY_RECEIVED",
                    message: "Billed from enquiry",
                  },
                  {
                    status: "ORDER_CONFIRMED",
                    message: "Order confirmed with invoice",
                  },
                ],
              },
            },
          });
        }

        linkedOrderId = order.id;
        linkedOrderNumber = order.number;

        const prior = await tx.loyaltyTransaction.findFirst({
          where: {
            type: "EARNED",
            note: `ENQUIRY_PAID:${enq.number}`,
          },
        });
        if (prior) pointsEarned = 0;

        await tx.enquiry.update({
          where: { id: enq.id },
          data: {
            /** Bill ready for customer after admin paid/convert + invoice */
            status: "BILL_SENT",
          },
        });
      }

      const invoice = await tx.invoice.create({
        data: {
          number,
          publicToken,
          idempotencyKey: body.idempotencyKey,
          customerId,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          enquiryId: linkedEnquiryId,
          orderId: linkedOrderId,
          subtotal: totals.mrpSubtotal,
          billDiscount: totals.offerDiscount,
          loyaltyRedeem: totals.loyaltyRedeem,
          grandTotal: totals.grandTotal,
          paidAmount,
          balanceAmount: Math.max(0, totals.grandTotal - paidAmount),
          paymentMethod: body.paymentMethod,
          pointsEarned,
          cashierId: auth.user!.id,
          items: { create: lines },
        },
        include: { items: true, order: true, enquiry: true },
      });

      for (const line of lines) {
        await tx.product.update({
          where: { id: line.productId },
          data: { stock: { decrement: line.quantity } },
        });
        await tx.stockTransaction.create({
          data: {
            productId: line.productId,
            delta: -line.quantity,
            reason: "BILLING",
            note: invoice.number,
          },
        });
      }

      if (body.customerPhone && pointsEarned > 0) {
        const account = await tx.loyaltyAccount.upsert({
          where: { phone: body.customerPhone },
          update: {
            availablePoints: { increment: pointsEarned },
            earnedPoints: { increment: pointsEarned },
          },
          create: {
            phone: body.customerPhone,
            customerId: customerId!,
            availablePoints: pointsEarned,
            earnedPoints: pointsEarned,
          },
        });
        await tx.loyaltyTransaction.create({
          data: {
            accountId: account.id,
            type: "EARNED",
            points: pointsEarned,
            note: enquiryNumberForLoyalty
              ? `ENQUIRY_PAID:${enquiryNumberForLoyalty}`
              : invoice.number,
          },
        });
      }

      return {
        invoice,
        totals: { ...totals, pointsEarned },
        orderNumber: linkedOrderNumber,
        enquiryNumber: linkedEnquiryNumber,
      };
    });

    await writeAudit(auth.user.id, "INVOICE_CREATE", "Invoice", result.invoice.id, {
      number: result.invoice.number,
      total: result.invoice.grandTotal,
      order: result.orderNumber,
    });

    scheduleShopNewInvoice({
      invoiceNumber: result.invoice.number,
      orderNumber: result.orderNumber,
      enquiryNumber: result.enquiryNumber,
      name: result.invoice.customerName || "Customer",
      phone: result.invoice.customerPhone,
      grandTotal: result.invoice.grandTotal,
      publicToken: result.invoice.publicToken,
    });

    const shop = await getShopSettings();
    return apiOk(
      {
        invoice: result.invoice,
        totals: result.totals,
        orderNumber: result.orderNumber,
        enquiryNumber: result.enquiryNumber,
        whatsappUrl: invoiceWhatsApp({
          name: result.invoice.customerName || "Customer",
          invoiceNumber: result.invoice.number,
          total: result.invoice.grandTotal,
          token: result.invoice.publicToken,
          shopName: shop.name,
          customerPhone: result.invoice.customerPhone || undefined,
          shopWhatsapp: shop.whatsapp,
          upiId: shop.upiId || undefined,
          orderNumber: result.orderNumber || undefined,
          enquiryNumber: result.enquiryNumber || undefined,
        }),
      },
      201
    );
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    const msg = e instanceof Error ? e.message : "";
    if (msg === "INSUFFICIENT_STOCK")
      return apiError("BUSINESS_RULE", "Quantity exceeds stock", 400);
    if (msg === "LOYALTY_BALANCE")
      return apiError("BUSINESS_RULE", "Loyalty redemption exceeds available points", 400);
    if (msg === "PRODUCT_UNAVAILABLE")
      return apiError("BUSINESS_RULE", "Product unavailable", 400);
    if (msg === "ENQUIRY_NOT_FOUND")
      return apiError("NOT_FOUND", "Enquiry not found", 404);
    if (msg === "ENQUIRY_ALREADY_INVOICED")
      return apiError(
        "BUSINESS_RULE",
        "This enquiry already has an invoice. Open Invoices to resend WhatsApp.",
        400
      );
    if (msg === "INVOICE_NOT_FOUND")
      return apiError("NOT_FOUND", "Invoice not found", 404);
    console.error(e);
    return apiError("INTERNAL_ERROR", "Billing failed", 500);
  }
}
