import { requireSession } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error } = await requireSession(["ADMIN"]);
  if (error) return apiError(error, "Forbidden", error === "FORBIDDEN" ? 403 : 401);

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [
    todayInvoices,
    newEnquiries,
    packing,
    shipped,
    delivered,
    lowStock,
    recentInvoices,
    recentFeedback,
    recentEnquiries,
    topProducts,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: { createdAt: { gte: start }, cancelledAt: null },
    }),
    prisma.enquiry.count({ where: { status: "NEW" } }),
    prisma.order.count({ where: { status: { in: ["PACKING", "PACKED"] } } }),
    prisma.order.count({ where: { status: { in: ["SHIPPED", "OUT_FOR_DELIVERY"] } } }),
    prisma.order.count({ where: { status: "DELIVERED" } }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { stock: "asc" },
      take: 10,
    }),
    prisma.invoice.findMany({
      where: { cancelledAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.feedback.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { order: true } }),
    prisma.enquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { customer: true, items: true },
    }),
    prisma.invoiceItem.groupBy({
      by: ["name"],
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
  ]);

  const todaySales = todayInvoices.reduce((s, i) => s + i.grandTotal, 0);
  const loyaltyIssued = todayInvoices.reduce((s, i) => s + i.pointsEarned, 0);

  return apiOk({
    metrics: {
      todaySales,
      todayInvoices: todayInvoices.length,
      newEnquiries,
      pendingPacking: packing,
      shipped,
      delivered,
      loyaltyIssued,
    },
    lowStock: lowStock
      .filter((p) => p.stock <= p.minStock)
      .map((p) => ({
        name: p.nameEn,
        code: p.code,
        stock: p.stock,
        min: p.minStock,
      })),
    topSelling: topProducts.map((t) => ({
      name: t.name,
      sold: t._sum.quantity || 0,
      revenue: t._sum.lineTotal || 0,
    })),
    recentInvoices,
    recentFeedback,
    recentEnquiries,
  });
}
