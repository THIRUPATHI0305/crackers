import { prisma } from "@/lib/prisma";
import { apiError, apiOk, maskPhone } from "@/lib/api";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const inv = await prisma.invoice.findFirst({
    where: { publicToken: token, cancelledAt: null },
    include: { items: { include: { product: true } } },
  });
  if (!inv) return apiError("NOT_FOUND", "Invoice not found", 404);

  const items = inv.items.map((i) => {
    const mrp = i.product?.originalPrice ?? i.unitPrice;
    return {
      name: i.name,
      qty: i.quantity,
      mrp,
      offerPrice: i.unitPrice,
      total: i.lineTotal,
      saved: Math.max(0, mrp * i.quantity - i.lineTotal),
    };
  });
  const mrpTotal = items.reduce((s, i) => s + i.mrp * i.qty, 0);
  const offerTotal = items.reduce((s, i) => s + i.total, 0);
  const catalogueDiscount = Math.max(0, mrpTotal - offerTotal);
  const promoDiscount = Math.max(0, inv.billDiscount - catalogueDiscount);

  return apiOk({
    invoice: {
      number: inv.number,
      date: inv.createdAt,
      customerName: inv.customerName,
      customerPhoneMasked: maskPhone(inv.customerPhone || ""),
      paymentMethod: inv.paymentMethod,
      mrpTotal: inv.subtotal,
      catalogueDiscount,
      promoDiscount,
      billDiscount: inv.billDiscount,
      loyaltyRedeem: inv.loyaltyRedeem,
      grandTotal: inv.grandTotal,
      pointsEarned: inv.pointsEarned,
      items,
    },
  });
}
