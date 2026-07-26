import { requireSession, writeAudit } from "@/lib/auth";
import { apiError, apiOk, fromZod, maskPhone } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getLoyaltyPublicSettings, getShopSettings } from "@/lib/shop-settings";
import { pointsForAmount } from "@/lib/enquiry-loyalty";
import { invoiceWhatsApp } from "@/lib/whatsapp";
import { z, ZodError } from "zod";

const paymentActionSchema = z.object({
  action: z.enum(["mark_paid", "reopen_pay"]),
  paymentMethod: z.enum(["CASH", "UPI", "CARD"]).optional(),
  awardPoints: z.boolean().optional().default(true),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession(["ADMIN", "CASHIER"]);
  if (error) return apiError(error, "Forbidden", error === "FORBIDDEN" ? 403 : 401);

  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: {
      OR: [{ id }, { number: id }, { publicToken: id }],
    },
    include: {
      items: true,
      cashier: { select: { email: true, username: true } },
      customer: true,
      order: { select: { id: true, number: true } },
      enquiry: { select: { id: true, number: true } },
    },
  });
  if (!invoice) return apiError("NOT_FOUND", "Invoice not found", 404);

  const shop = await getShopSettings();
  const whatsappUrl = invoice.customerPhone
    ? invoiceWhatsApp({
        name: invoice.customerName || "Customer",
        invoiceNumber: invoice.number,
        total: invoice.grandTotal,
        token: invoice.publicToken,
        shopName: shop.name,
        customerPhone: invoice.customerPhone,
        shopWhatsapp: shop.whatsapp,
        upiId: shop.upiId || undefined,
        orderNumber: invoice.order?.number,
        enquiryNumber: invoice.enquiry?.number,
      })
    : null;

  const payOpen =
    invoice.balanceAmount > 0.009 &&
    invoice.paidAmount + 0.009 < invoice.grandTotal;

  return apiOk({
    invoice: {
      ...invoice,
      customerPhoneMasked: invoice.customerPhone
        ? maskPhone(invoice.customerPhone)
        : null,
      payOpen,
    },
    whatsappUrl,
  });
}

/**
 * Mark payment received (closes /pay link) or reopen unpaid balance (opens link again).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(["ADMIN", "CASHIER"]);
  if (auth.error || !auth.user) {
    return apiError(auth.error || "UNAUTHORIZED", "Forbidden", 401);
  }

  try {
    const body = paymentActionSchema.parse(await req.json());
    const { id } = await params;
    const invoice = await prisma.invoice.findFirst({
      where: {
        cancelledAt: null,
        OR: [{ id }, { number: id }, { publicToken: id }],
      },
      include: {
        enquiry: { select: { id: true, number: true } },
        order: { select: { id: true, number: true } },
      },
    });
    if (!invoice) return apiError("NOT_FOUND", "Invoice not found", 404);

    if (body.action === "reopen_pay") {
      const updated = await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: 0,
          balanceAmount: invoice.grandTotal,
        },
        include: {
          items: true,
          cashier: { select: { email: true, username: true } },
          order: { select: { id: true, number: true } },
          enquiry: { select: { id: true, number: true } },
        },
      });
      await writeAudit(auth.user.id, "INVOICE_REOPEN_PAY", "Invoice", invoice.id, {
        number: invoice.number,
      });
      return apiOk({
        invoice: {
          ...updated,
          customerPhoneMasked: updated.customerPhone
            ? maskPhone(updated.customerPhone)
            : null,
          payOpen: true,
        },
      });
    }

    /** mark_paid */
    const loyalty = await getLoyaltyPublicSettings();
    const enquiryNumber = invoice.enquiry?.number || null;

    const result = await prisma.$transaction(async (tx) => {
      let pointsEarned = invoice.pointsEarned || 0;
      const shouldAward =
        body.awardPoints !== false &&
        Boolean(invoice.customerPhone) &&
        loyalty.enabled;

      if (shouldAward) {
        const earnNoteCandidates = [
          invoice.number,
          enquiryNumber ? `ENQUIRY_PAID:${enquiryNumber}` : null,
        ].filter(Boolean) as string[];
        const prior = await tx.loyaltyTransaction.findFirst({
          where: {
            type: "EARNED",
            note: { in: earnNoteCandidates },
          },
        });
        if (!prior) {
          const pts =
            pointsEarned > 0
              ? pointsEarned
              : pointsForAmount(invoice.grandTotal, loyalty.pointsPerHundred);
          if (pts > 0 && invoice.customerPhone) {
            const account = await tx.loyaltyAccount.upsert({
              where: { phone: invoice.customerPhone },
              update: {
                availablePoints: { increment: pts },
                earnedPoints: { increment: pts },
              },
              create: {
                phone: invoice.customerPhone,
                customerId: invoice.customerId || undefined,
                availablePoints: pts,
                earnedPoints: pts,
              },
            });
            await tx.loyaltyTransaction.create({
              data: {
                accountId: account.id,
                type: "EARNED",
                points: pts,
                note: enquiryNumber
                  ? `ENQUIRY_PAID:${enquiryNumber}`
                  : invoice.number,
              },
            });
            pointsEarned = pts;
          }
        }
      }

      return tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: invoice.grandTotal,
          balanceAmount: 0,
          paymentMethod: body.paymentMethod || invoice.paymentMethod || "UPI",
          pointsEarned,
        },
        include: {
          items: true,
          cashier: { select: { email: true, username: true } },
          order: { select: { id: true, number: true } },
          enquiry: { select: { id: true, number: true } },
        },
      });
    });

    await writeAudit(auth.user.id, "INVOICE_MARK_PAID", "Invoice", invoice.id, {
      number: invoice.number,
      method: body.paymentMethod || invoice.paymentMethod,
    });

    return apiOk({
      invoice: {
        ...result,
        customerPhoneMasked: result.customerPhone
          ? maskPhone(result.customerPhone)
          : null,
        payOpen: false,
      },
    });
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    console.error(e);
    return apiError("INTERNAL_ERROR", "Could not update payment status", 500);
  }
}

/**
 * Hard-delete invoice + linked order + enquiry.
 * Restores stock and reverses loyalty earn/redeem for this bill.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(["ADMIN", "CASHIER"]);
  if (auth.error || !auth.user) {
    return apiError(auth.error || "UNAUTHORIZED", "Forbidden", 401);
  }

  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: {
      OR: [{ id }, { number: id }, { publicToken: id }],
    },
    include: {
      items: true,
      order: { select: { id: true, number: true, enquiryId: true } },
      enquiry: { select: { id: true, number: true } },
    },
  });
  if (!invoice) return apiError("NOT_FOUND", "Invoice not found", 404);

  const orderId = invoice.orderId || invoice.order?.id || null;
  const enquiryId =
    invoice.enquiryId ||
    invoice.enquiry?.id ||
    invoice.order?.enquiryId ||
    null;
  const enquiryNumber = invoice.enquiry?.number || null;

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of invoice.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
        await tx.stockTransaction.create({
          data: {
            productId: item.productId,
            delta: item.quantity,
            reason: "BILLING_DELETE",
            note: `${invoice.number} deleted`,
          },
        });
      }

      if (invoice.customerPhone) {
        const account = await tx.loyaltyAccount.findUnique({
          where: { phone: invoice.customerPhone },
        });
        if (account) {
          const redeemPts = Math.round(invoice.loyaltyRedeem || 0);
          if (redeemPts > 0) {
            await tx.loyaltyAccount.update({
              where: { id: account.id },
              data: {
                availablePoints: { increment: redeemPts },
                redeemedPoints: { decrement: redeemPts },
              },
            });
          }

          const earnNoteCandidates = [
            invoice.number,
            enquiryNumber ? `ENQUIRY_PAID:${enquiryNumber}` : null,
          ].filter(Boolean) as string[];

          const earnTxs =
            earnNoteCandidates.length > 0
              ? await tx.loyaltyTransaction.findMany({
                  where: {
                    accountId: account.id,
                    type: "EARNED",
                    note: { in: earnNoteCandidates },
                  },
                })
              : [];

          const earnTx =
            earnTxs.find((t) => t.note === invoice.number) ||
            earnTxs.find(
              (t) =>
                enquiryNumber && t.note === `ENQUIRY_PAID:${enquiryNumber}`
            ) ||
            null;

          if (earnTx && earnTx.points > 0) {
            await tx.loyaltyAccount.update({
              where: { id: account.id },
              data: {
                availablePoints: { decrement: earnTx.points },
                earnedPoints: { decrement: earnTx.points },
              },
            });
          }

          await tx.loyaltyTransaction.deleteMany({
            where: {
              accountId: account.id,
              OR: [
                { note: invoice.number },
                { note: `${invoice.number} edit restore redeem` },
                { note: `${invoice.number} edit reverse earn` },
                ...(enquiryNumber
                  ? [{ note: `ENQUIRY_PAID:${enquiryNumber}` as const }]
                  : []),
                ...(redeemPts > 0
                  ? [
                      {
                        type: "REDEEMED" as const,
                        points: redeemPts,
                        note: "Billing redemption",
                        createdAt: {
                          gte: new Date(invoice.createdAt.getTime() - 60_000),
                          lte: new Date(invoice.createdAt.getTime() + 60_000),
                        },
                      },
                    ]
                  : []),
              ],
            },
          });
        }
      }

      await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
      await tx.invoice.delete({ where: { id: invoice.id } });

      if (orderId) {
        await tx.order.delete({ where: { id: orderId } });
      }

      if (enquiryId) {
        await tx.enquiry.delete({ where: { id: enquiryId } });
      }
    });

    await writeAudit(auth.user.id, "INVOICE_DELETE", "Invoice", invoice.id, {
      number: invoice.number,
      orderId,
      enquiryId,
    });

    return apiOk({
      deleted: true,
      invoiceNumber: invoice.number,
      orderId,
      enquiryId,
    });
  } catch (e) {
    console.error(e);
    return apiError("INTERNAL_ERROR", "Could not delete invoice", 500);
  }
}
