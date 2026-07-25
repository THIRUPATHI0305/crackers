"use client";

import { useState, type FormEvent } from "react";
import { fieldErrorsFromZod, useCsrf } from "@/lib/use-csrf";
import { trackOrderSchema } from "@/lib/validation";
import { PhoneField, TextField } from "@/components/forms/Fields";

const STATUS_FLOW = [
  "ENQUIRY_RECEIVED",
  "ORDER_CONFIRMED",
  "PACKING",
  "PACKED",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "LR_SENT",
];

export default function TrackOrderPage() {
  const { withCsrf, ready } = useCsrf();
  const [tracked, setTracked] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<{
    number: string;
    status: string;
    customerName: string | null;
    date: string;
    eta: string | null;
    customerNote: string | null;
    history: { status: string; message: string | null; createdAt: string }[];
  } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    const parsed = trackOrderSchema.safeParse({ orderNumber, phone });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "_";
        if (!fe[key]) fe[key] = issue.message;
      }
      setFieldErrors(fe);
      setError("Please fix the highlighted fields");
      return;
    }
    setLoading(true);
    try {
      const init = await withCsrf({
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      const res = await fetch("/api/order-tracking", init);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Not found");
        setFieldErrors(fieldErrorsFromZod(data?.error || {}));
        setLoading(false);
        return;
      }
      setOrder(data.order);
      setTracked(true);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="bg-atmosphere min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold text-navy">
          Track your order
        </h1>
        <p className="mt-2 text-muted">
          Enter order number and mobile number — no login required.
        </p>

        {!tracked ? (
          <form
            className="mt-8 space-y-4 rounded-3xl border border-border bg-surface p-8 shadow-sm"
            onSubmit={onSubmit}
          >
            <TextField
              label="Order number *"
              value={orderNumber}
              onChange={(e) =>
                setOrderNumber(e.target.value.trim().slice(0, 20).toUpperCase())
              }
              placeholder="ORD-2026-0001"
              error={fieldErrors.orderNumber}
              maxLength={20}
              required
            />
            <PhoneField
              label="Mobile number *"
              value={phone}
              onChange={setPhone}
              error={fieldErrors.phone}
              required
            />
            {error && (
              <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !ready}
              className="w-full rounded-full bg-navy py-3.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {loading ? "Looking up…" : "Track order"}
            </button>
          </form>
        ) : (
          order && (
            <div className="mt-8 space-y-6">
              <div className="rounded-3xl border border-border bg-surface p-8 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted">Order number</p>
                    <p className="text-xl font-bold text-navy">{order.number}</p>
                    <p className="mt-1 text-sm text-muted">
                      {order.customerName} ·{" "}
                      {new Date(order.date).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber/15 px-3 py-1.5 text-sm font-bold text-amber">
                    {order.status.replaceAll("_", " ")}
                  </span>
                </div>
                {order.customerNote && (
                  <p className="mt-4 rounded-xl bg-surface-muted px-4 py-3 text-sm text-navy">
                    {order.customerNote}
                  </p>
                )}
              </div>

              <div className="rounded-3xl border border-border bg-surface p-8 shadow-sm">
                <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-navy">
                  Status timeline
                </h2>
                <ol className="mt-6 space-y-0">
                  {STATUS_FLOW.map((s, i) => {
                    const done =
                      STATUS_FLOW.indexOf(order.status) >= i ||
                      order.history.some((h) => h.status === s);
                    const hist = order.history.find((h) => h.status === s);
                    return (
                      <li key={s} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                              done
                                ? "bg-success text-white"
                                : "border-2 border-border bg-surface text-muted"
                            }`}
                          >
                            {done ? "✓" : i + 1}
                          </span>
                          {i < STATUS_FLOW.length - 1 && (
                            <span
                              className={`min-h-8 w-0.5 flex-1 ${
                                done ? "bg-success/40" : "bg-border"
                              }`}
                            />
                          )}
                        </div>
                        <div className="pb-6">
                          <p
                            className={`font-semibold ${
                              done ? "text-navy" : "text-muted"
                            }`}
                          >
                            {s.replaceAll("_", " ")}
                          </p>
                          {hist && (
                            <p className="text-xs text-muted">
                              {new Date(hist.createdAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <button
                type="button"
                onClick={() => {
                  setTracked(false);
                  setOrder(null);
                  setLoading(false);
                }}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-navy"
              >
                Track another order
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
