import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatInr, maskPhone } from "@/lib/api";
import { getShopSettings } from "@/lib/shop-settings";
import { normalizeUpiId, upiAppLinks } from "@/lib/upi";
import { PayActions } from "@/components/PayActions";

export const dynamic = "force-dynamic";

function isFullyPaid(inv: { paidAmount: number; balanceAmount: number; grandTotal: number }) {
  return inv.balanceAmount <= 0.009 || inv.paidAmount + 0.009 >= inv.grandTotal;
}

export default async function PayInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [inv, shop] = await Promise.all([
    prisma.invoice.findFirst({
      where: {
        cancelledAt: null,
        OR: [{ publicToken: token }, { number: token }],
      },
      include: {
        enquiry: { select: { status: true } },
      },
    }),
    getShopSettings(),
  ]);
  if (!inv) notFound();

  /** Closed when invoice settled OR linked enquiry marked PAID */
  const paid = isFullyPaid(inv) || inv.enquiry?.status === "PAID";
  const amountLabel = formatInr(inv.grandTotal);
  const balanceLabel = formatInr(inv.balanceAmount);

  const upiId = normalizeUpiId(shop.upiId || "");
  const links =
    !paid && upiId
      ? upiAppLinks({
          upiId,
          payeeName: shop.name || "Shop",
          amount: inv.balanceAmount > 0 ? inv.balanceAmount : inv.grandTotal,
          note: inv.number,
        })
      : null;

  return (
    <div className="min-h-screen bg-atmosphere px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-surface p-8 text-center shadow-sm">
        <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-navy">
          {shop.name || "Pay invoice"}
        </p>
        <p className="mt-2 text-sm text-muted">Invoice {inv.number}</p>
        <p className="mt-1 text-sm text-muted">
          {inv.customerName || "Customer"} ·{" "}
          {maskPhone(inv.customerPhone || "")}
        </p>

        {paid ? (
          <>
            <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-success">
              Payment received
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-navy">
              {amountLabel}
            </p>
            <p className="mt-6 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-navy">
              This pay link is closed. Thank you — no further payment is needed.
            </p>
          </>
        ) : (
          <>
            <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-muted">
              Amount to pay
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-navy">
              {inv.balanceAmount > 0 && inv.balanceAmount < inv.grandTotal
                ? balanceLabel
                : amountLabel}
            </p>
            {inv.paidAmount > 0 ? (
              <p className="mt-2 text-xs text-muted">
                Paid {formatInr(inv.paidAmount)} · balance {balanceLabel}
              </p>
            ) : null}

            {links ? (
              <PayActions
                links={links}
                amountLabel={
                  inv.balanceAmount > 0 && inv.balanceAmount < inv.grandTotal
                    ? balanceLabel
                    : amountLabel
                }
                payeeName={shop.name || "Shop"}
              />
            ) : (
              <p className="mt-8 rounded-xl bg-amber/10 px-4 py-3 text-sm text-amber">
                UPI payments are not set up yet. Contact the shop to pay.
              </p>
            )}
          </>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/invoice/${inv.publicToken}`}
            className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-navy"
          >
            View bill
          </Link>
          <Link
            href="/track-order"
            className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-navy"
          >
            Track order
          </Link>
        </div>
      </div>
    </div>
  );
}
