import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatInr } from "@/lib/api";
import { ORDER_STATUS_LABELS } from "@/lib/order-transitions";
import { OrderStatusForm } from "./status-form";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      history: { orderBy: { createdAt: "asc" } },
      proofs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/admin/orders" className="text-sm font-semibold text-muted">
            ← Orders
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
            {order.number}
          </h1>
        </div>
        <span className="rounded-full bg-amber/15 px-3 py-1.5 text-sm font-bold text-amber">
          {ORDER_STATUS_LABELS[order.status] ||
            order.status.replaceAll("_", " ")}
        </span>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Customer</dt>
            <dd className="font-semibold text-navy">{order.customer.name}</dd>
          </div>
          <div>
            <dt className="text-muted">Phone</dt>
            <dd className="font-semibold text-navy">{order.customer.phone}</dd>
          </div>
          <div>
            <dt className="text-muted">Amount</dt>
            <dd className="font-semibold text-navy">{formatInr(order.amount)}</dd>
          </div>
        </dl>
      </div>

      {order.proofs.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="font-bold text-navy">LR / proof copies</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {order.proofs.map((p) => (
              <li key={p.id}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-amber underline-offset-2 hover:underline"
                >
                  View uploaded file
                </a>
                <span className="ml-2 text-xs text-muted">
                  {new Date(p.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {order.history.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="font-bold text-navy">Status history</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {order.history.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap justify-between gap-2 border-b border-border/60 pb-2"
              >
                <span className="font-semibold text-navy">
                  {h.status.replaceAll("_", " ")}
                </span>
                <span className="text-xs text-muted">
                  {new Date(h.createdAt).toLocaleString()}
                </span>
                {h.message && (
                  <p className="w-full text-muted">{h.message}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <OrderStatusForm
        orderId={order.id}
        currentStatus={order.status}
        phone={order.customer.phone}
        orderNumber={order.number}
      />
    </div>
  );
}
