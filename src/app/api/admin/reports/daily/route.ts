import { requireSession } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";

function dayRange(dateStr?: string | null) {
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 1);
    return { start: today, end };
  }
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function GET(req: Request) {
  const { error } = await requireSession(["ADMIN"]);
  if (error) return apiError(error, "Forbidden", error === "FORBIDDEN" ? 403 : 401);

  const date = new URL(req.url).searchParams.get("date");
  const { start, end } = dayRange(date);

  const invoices = await prisma.invoice.findMany({
    where: {
      createdAt: { gte: start, lt: end },
    },
    include: { items: true },
  });

  const active = invoices.filter((i) => !i.cancelledAt);
  const cancelled = invoices.filter((i) => i.cancelledAt).length;

  const totals = {
    total: active.reduce((s, i) => s + i.grandTotal, 0),
    cash: active
      .filter((i) => i.paymentMethod === "CASH")
      .reduce((s, i) => s + i.grandTotal, 0),
    upi: active
      .filter((i) => i.paymentMethod === "UPI")
      .reduce((s, i) => s + i.grandTotal, 0),
    card: active
      .filter((i) => i.paymentMethod === "CARD")
      .reduce((s, i) => s + i.grandTotal, 0),
    discount: active.reduce((s, i) => s + i.billDiscount, 0),
    loyaltyRedeemed: active.reduce((s, i) => s + i.loyaltyRedeem, 0),
    invoiceCount: active.length,
    cancelled,
    qtySold: active.reduce(
      (s, i) => s + i.items.reduce((q, it) => q + it.quantity, 0),
      0
    ),
  };

  const byProduct = new Map<
    string,
    { name: string; sold: number; revenue: number }
  >();
  for (const inv of active) {
    for (const it of inv.items) {
      const cur = byProduct.get(it.productId) || {
        name: it.name,
        sold: 0,
        revenue: 0,
      };
      cur.sold += it.quantity;
      cur.revenue += it.lineTotal;
      byProduct.set(it.productId, cur);
    }
  }

  const topSelling = [...byProduct.values()]
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 10);

  return apiOk({
    date: start.toISOString().slice(0, 10),
    totals,
    topSelling,
  });
}
