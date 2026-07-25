import { ZodError } from "zod";
import { requireSession, writeAudit } from "@/lib/auth";
import { apiError, apiOk, fromZod } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { orderStatusUpdateSchema } from "@/lib/validation";
import {
  ORDER_STATUS_LABELS,
  STATUS_REQUIRES_LR,
} from "@/lib/order-transitions";
import {
  feedbackPageUrl,
  orderStatusWhatsApp,
} from "@/lib/whatsapp";
import { getShopSettings } from "@/lib/shop-settings";
import { z } from "zod";

export async function GET() {
  const { error } = await requireSession(["ADMIN"]);
  if (error) return apiError(error, "Forbidden", 401);
  const orders = await prisma.order.findMany({
    include: { customer: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return apiOk({ orders });
}

const updateBody = orderStatusUpdateSchema.extend({
  id: z.string().min(1),
});

export async function PUT(req: Request) {
  const auth = await requireSession(["ADMIN"]);
  if (auth.error || !auth.user)
    return apiError(auth.error || "UNAUTHORIZED", "Forbidden", 401);

  try {
    const body = updateBody.parse(await req.json());
    const order = await prisma.order.findUnique({
      where: { id: body.id },
      include: { customer: true, proofs: true },
    });
    if (!order) return apiError("NOT_FOUND", "Order not found", 404);

    // Admin may set any valid status (and re-send WhatsApp anytime)
    if (!(body.status in ORDER_STATUS_LABELS)) {
      return apiError("VALIDATION_ERROR", "Unknown status", 400);
    }

    if (STATUS_REQUIRES_LR.has(body.status) && !body.lrProofUrl) {
      return apiError(
        "VALIDATION_ERROR",
        "Upload LR / transport copy before marking LR sent",
        400
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id: order.id },
        data: {
          status: body.status,
          customerNote: body.customerMessage,
          internalNote: body.internalNote,
          eta: body.eta,
          deliveredAt:
            body.status === "DELIVERED"
              ? order.deliveredAt || new Date()
              : order.deliveredAt,
        },
        include: { customer: true, proofs: true },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: body.status,
          message: body.customerMessage,
        },
      });
      if (body.lrProofUrl) {
        await tx.orderProofImage.create({
          data: {
            orderId: order.id,
            url: body.lrProofUrl,
          },
        });
      }
      return o;
    });

    await writeAudit(auth.user.id, "ORDER_STATUS", "Order", order.id, {
      from: order.status,
      to: body.status,
    });

    const feedbackUrl =
      body.status === "DELIVERED" || body.status === "LR_SENT"
        ? feedbackPageUrl(updated.number, updated.customer.phone)
        : undefined;

    const shop = await getShopSettings();
    const whatsappUrl = orderStatusWhatsApp({
      name: updated.customer.name || "Customer",
      orderNumber: updated.number,
      status: updated.status,
      statusLabel: ORDER_STATUS_LABELS[updated.status],
      message: body.customerMessage,
      phone: updated.customer.phone,
      lrUrl: body.lrProofUrl || undefined,
      feedbackUrl,
      shopName: shop.name,
      shopWhatsapp: shop.whatsapp,
    });

    return apiOk({
      order: updated,
      whatsappUrl,
      feedbackUrl,
      statusLabel: ORDER_STATUS_LABELS[updated.status],
    });
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    console.error(e);
    return apiError("INTERNAL_ERROR", "Update failed", 500);
  }
}
