import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatInr, maskPhone } from "@/lib/api";
import { getShopSettings } from "@/lib/shop-settings";
import { normalizeWaDigits } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ invoiceNumber: string }>;
}) {
  const { invoiceNumber: key } = await params;
  const [inv, shop] = await Promise.all([
    prisma.invoice.findFirst({
      where: {
        cancelledAt: null,
        OR: [{ publicToken: key }, { number: key }],
      },
      include: {
        items: { include: { product: true } },
      },
    }),
    getShopSettings(),
  ]);
  if (!inv) notFound();

  /** Catalogue MRP × qty (prefer product.originalPrice; fall back to invoice subtotal) */
  const mrpLines = inv.items.map((item) => {
    const mrp = item.product?.originalPrice ?? item.unitPrice;
    const mrpLine = mrp * item.quantity;
    const offerLine = item.lineTotal;
    return { item, mrpLine, offerLine };
  });

  const mrpTotal = mrpLines.reduce((s, l) => s + l.mrpLine, 0) || inv.subtotal;
  const offerItemsTotal = mrpLines.reduce((s, l) => s + l.offerLine, 0);
  const catalogueDiscount = Math.max(0, mrpTotal - offerItemsTotal);
  /** Extra promo beyond MRP→offer (festival / category / buy-more) */
  const promoDiscount = Math.max(0, inv.billDiscount - catalogueDiscount);

  return (
    <div className="min-h-screen bg-atmosphere px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-surface p-8 shadow-sm">
        <div className="text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-navy">
            {shop.name}
          </p>
          <p className="mt-1 text-sm text-muted">{shop.address}</p>
          <p className="text-sm text-muted">{shop.phone}</p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-y border-border py-4 text-sm">
          <div>
            <p className="text-muted">Invoice</p>
            <p className="font-bold text-navy">{inv.number}</p>
          </div>
          <div className="text-right">
            <p className="text-muted">Date</p>
            <p className="font-bold text-navy">
              {inv.createdAt.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted">Customer:</span>{" "}
            <strong>{inv.customerName || "Customer"}</strong>
          </p>
          <p>
            <span className="text-muted">Mobile:</span>{" "}
            <strong>{maskPhone(inv.customerPhone || "")}</strong>
          </p>
          <p>
            <span className="text-muted">Payment:</span>{" "}
            <strong>{inv.paymentMethod}</strong>
          </p>
          <p>
            <span className="text-muted">Loyalty points:</span>{" "}
            <strong className="text-success">+{inv.pointsEarned}</strong>
          </p>
        </div>

        <ul className="mt-6 space-y-3">
          {mrpLines.map(({ item, mrpLine }) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted/70 px-4 py-3 text-sm"
            >
              <p className="min-w-0 font-semibold text-navy">
                {item.name}
                {item.quantity > 1 ? (
                  <span className="font-normal text-muted"> ×{item.quantity}</span>
                ) : null}
              </p>
              <p className="shrink-0 font-bold text-navy">
                {formatInr(mrpLine)}
              </p>
            </li>
          ))}
        </ul>

        {/* Totals only: MRP → % discount → promo → loyalty → pay */}
        <div className="mt-6 space-y-1.5 border-t border-border pt-4 text-sm">
          <div className="flex justify-between text-muted">
            <span>MRP total</span>
            <span>{formatInr(mrpTotal)}</span>
          </div>
          {catalogueDiscount > 0 && (
            <div className="flex justify-between text-success">
              <span>
                {mrpTotal > 0
                  ? `${Math.round((catalogueDiscount / mrpTotal) * 100)}% discount`
                  : "Discount"}
              </span>
              <span>−{formatInr(catalogueDiscount)}</span>
            </div>
          )}
          {promoDiscount > 0 && (
            <div className="flex justify-between text-success">
              <span>Promo offer</span>
              <span>−{formatInr(promoDiscount)}</span>
            </div>
          )}
          {inv.billDiscount > 0 &&
            promoDiscount === 0 &&
            catalogueDiscount === 0 && (
              <div className="flex justify-between text-success">
                <span>Discount</span>
                <span>−{formatInr(inv.billDiscount)}</span>
              </div>
            )}
          {inv.loyaltyRedeem > 0 && (
            <div className="flex justify-between text-muted">
              <span>Loyalty redeem</span>
              <span>−{formatInr(inv.loyaltyRedeem)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 text-lg font-bold text-navy">
            <span>You pay</span>
            <span>{formatInr(inv.grandTotal)}</span>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {normalizeWaDigits(shop.whatsapp) ? (
            <a
              href={`https://wa.me/${normalizeWaDigits(shop.whatsapp)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white"
            >
              WhatsApp contact
            </a>
          ) : null}
          <Link
            href="/"
            className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-navy"
          >
            Back to shop
          </Link>
        </div>
      </div>
    </div>
  );
}
