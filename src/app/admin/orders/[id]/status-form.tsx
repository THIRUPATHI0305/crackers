"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ADMIN_STATUS_OPTIONS,
  ORDER_STATUS_LABELS,
  STATUS_REQUIRES_LR,
} from "@/lib/order-transitions";
import { feedbackPageUrl, waToCustomer } from "@/lib/whatsapp";

function LrCopyUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", "orders");
      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Upload failed");
        setUploading(false);
        return;
      }
      onChange(data.url as string);
    } catch {
      setError("Network error while uploading");
    }
    setUploading(false);
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-amber bg-amber/5 p-4">
      <p className="text-sm font-bold text-navy">
        LR / transport copy (required)
      </p>
      <p className="mt-1 text-xs text-muted">
        Upload the LR copy — it will be sent to the customer on WhatsApp.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white">
          {uploading ? "Uploading…" : "Choose LR file"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        {value && (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-amber underline-offset-2 hover:underline"
          >
            View uploaded file
          </a>
        )}
      </div>

      {value && (
        <p className="mt-2 truncate rounded-xl bg-surface px-3 py-2 text-xs text-navy">
          {value}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function OrderStatusForm({
  orderId,
  currentStatus,
  phone,
  orderNumber,
}: {
  orderId: string;
  currentStatus: string;
  phone: string;
  orderNumber: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [feedbackUrl, setFeedbackUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [lrUrl, setLrUrl] = useState("");
  const [selected, setSelected] = useState(
    ADMIN_STATUS_OPTIONS.includes(
      currentStatus as (typeof ADMIN_STATUS_OPTIONS)[number]
    )
      ? currentStatus
      : "PACKING"
  );
  const [shopName, setShopName] = useState("Shop");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.shop?.name) setShopName(data.shop.name);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSelected(
      ADMIN_STATUS_OPTIONS.includes(
        currentStatus as (typeof ADMIN_STATUS_OPTIONS)[number]
      )
        ? currentStatus
        : "PACKING"
    );
    setLrUrl("");
  }, [currentStatus]);

  const needsLr =
    selected === "LR_SENT" || STATUS_REQUIRES_LR.has(selected);

  const hint =
    selected === "PACKING"
      ? "Start packing this order."
      : selected === "PACKED"
        ? "Mark packed when packing is complete."
        : selected === "SHIPPED"
          ? "Mark when the lorry has been dispatched."
          : selected === "OUT_FOR_DELIVERY"
            ? "Order is out for delivery."
            : selected === "DELIVERED"
              ? "Mark delivered — WhatsApp includes customer feedback link."
              : selected === "LR_SENT"
                ? "Upload LR copy below, then send it to the customer on WhatsApp."
                : "";

  return (
    <form
      className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        setMsg("");
        if (needsLr && !lrUrl) {
          setMsg("Please upload LR / transport copy first");
          setLoading(false);
          return;
        }
        const form = new FormData(e.currentTarget);
        const status = String(form.get("status") || selected);
        const res = await fetch("/api/admin/orders", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: orderId,
            status,
            customerMessage: form.get("message") || undefined,
            internalNote: form.get("internal") || undefined,
            lrProofUrl: lrUrl || undefined,
          }),
        });
        const data = await res.json();
        setLoading(false);
        if (!res.ok) {
          setMsg(data?.error?.message || "Update failed");
          return;
        }
        setMsg(
          `Updated to ${data.statusLabel || data.order.status.replaceAll("_", " ")} — WhatsApp ready`
        );
        setWhatsappUrl(data.whatsappUrl || "");
        setFeedbackUrl(data.feedbackUrl || "");
        setLrUrl("");
        if (data.whatsappUrl) {
          window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
        }
        router.refresh();
      }}
    >
      <h2 className="font-bold text-navy">Update status</h2>
      <p className="text-xs text-muted">
        Current:{" "}
        <span className="font-semibold text-navy">
          {ORDER_STATUS_LABELS[currentStatus] ||
            currentStatus.replaceAll("_", " ")}
        </span>
      </p>

      <label className="block text-sm font-semibold text-navy">
        New status
        <select
          name="status"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm"
        >
          {ADMIN_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s] || s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>

      {hint && (
        <p className="rounded-xl bg-amber/10 px-3 py-2 text-xs text-navy">
          {hint}
        </p>
      )}

      {needsLr && <LrCopyUpload value={lrUrl} onChange={setLrUrl} />}

      <textarea
        name="message"
        rows={3}
        placeholder="Message to customer…"
        className="w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm"
      />
      <textarea
        name="internal"
        rows={2}
        placeholder="Internal note…"
        className="w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm"
      />

      {msg && (
        <p className="rounded-xl bg-surface-muted px-3 py-2 text-sm text-navy">
          {msg}
        </p>
      )}

      {feedbackUrl && (
        <p className="rounded-xl bg-success/10 px-3 py-2 text-xs text-success">
          Feedback link: {feedbackUrl}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={loading || (needsLr && !lrUrl)}
          className="rounded-full bg-amber px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {loading ? "Updating…" : "Update & send WhatsApp"}
        </button>
        <a
          href={
            whatsappUrl ||
            waToCustomer(
              phone,
              `Hello,\n\nYour order ${orderNumber} status: ${ORDER_STATUS_LABELS[selected] || selected}.\n\n— ${shopName}`
            )
          }
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-5 py-2.5 text-sm font-semibold text-[#128C7E]"
        >
          Open WhatsApp
        </a>
      </div>

      <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted">
        <li>Packing → Packed</li>
        <li>Lorry dispatched → Out for delivery</li>
        <li>Delivered — feedback link on WhatsApp</li>
        <li>LR copy sent — upload LR &amp; notify customer</li>
      </ol>
    </form>
  );
}
