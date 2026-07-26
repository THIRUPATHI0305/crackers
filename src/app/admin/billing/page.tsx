"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { formatInr } from "@/lib/admin-data";
import { QtyStepper, TrashIcon } from "@/components/QtyStepper";
import {
  computeBillingTotals,
  type BillingOffer,
  type LoyaltySettings,
} from "@/lib/billing-calc";
import { billPrintCss } from "@/lib/bill-print";

type CatalogProduct = {
  id: string;
  nameEn: string;
  code: string;
  originalPrice: number;
  offerPrice: number;
  stock: number;
  imageUrl: string | null;
  category: { id: string; nameEn: string; slug: string };
};

type BillLine = {
  id: string;
  name: string;
  code: string;
  originalPrice: number;
  offerPrice: number;
  stock: number;
  qty: number;
  categorySlug: string;
  categoryName: string;
};

type SavedInvoice = {
  id: string;
  number: string;
  publicToken: string;
  grandTotal: number;
  subtotal: number;
  billDiscount: number;
  loyaltyRedeem: number;
  pointsEarned: number;
  paymentMethod: string;
  customerName: string | null;
  customerPhone: string | null;
  orderNumber?: string | null;
  enquiryNumber?: string | null;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    /** MRP line total for display (before catalogue discount) */
    mrpLineTotal?: number;
  }[];
};

const DEFAULT_LOYALTY: LoyaltySettings = {
  pointsPerHundred: 1,
  minRedemptionPoints: 1,
  maxDiscountPercent: 30,
  maxLoyaltyDiscountAmount: 5000,
  enabled: true,
};

export default function BillingPage() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [offers, setOffers] = useState<BillingOffer[]>([]);
  const [loyaltySettings, setLoyaltySettings] =
    useState<LoyaltySettings>(DEFAULT_LOYALTY);
  const [shopName, setShopName] = useState("Shop");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [lines, setLines] = useState<BillLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [payment, setPayment] = useState<"Cash" | "UPI" | "Card">("UPI");
  const [loyaltyAvailable, setLoyaltyAvailable] = useState(0);
  /** Cashier chooses: redeem points now, or keep stored for later */
  const [loyaltyMode, setLoyaltyMode] = useState<"redeem" | "keep">("keep");
  /** Paid → credit pts for next bill; Unpaid → no pts for this amount */
  const [billPaid, setBillPaid] = useState(true);
  const [enquiryId, setEnquiryId] = useState<string | null>(null);
  /** When set, Save updates this invoice (same INV + customer WA link) */
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [savedInvoice, setSavedInvoice] = useState<SavedInvoice | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showBillPopup, setShowBillPopup] = useState(false);
  const [printMode, setPrintMode] = useState<"a4" | "thermal" | null>(null);
  /** Snapshot used to restore cart for edit after save */
  const [editDraft, setEditDraft] = useState<{
    lines: BillLine[];
    customerName: string;
    customerPhone: string;
    payment: "Cash" | "UPI" | "Card";
  } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/products?pageSize=500&inStock=true").then((r) => r.json()),
      fetch("/api/offers").then((r) => r.json()),
      fetch("/api/admin/settings")
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([prod, off, settings]) => {
      setProducts(prod.products || []);
      setOffers(
        (off.offers || []).map(
          (o: {
            type: string;
            title: string;
            percentOff: number | null;
            fixedOff: number | null;
            categorySlugs?: string[];
            productIds?: string[];
          }) => ({
            type: o.type,
            title: o.title,
            percentOff: o.percentOff,
            fixedOff: o.fixedOff,
            categorySlugs: o.categorySlugs || [],
            productIds: o.productIds || [],
          })
        )
      );
      if (settings?.loyalty) {
        setLoyaltySettings({
          ...DEFAULT_LOYALTY,
          ...settings.loyalty,
          minRedemptionPoints: 1,
        });
      }
      if (settings?.shop?.name) setShopName(settings.shop.name);
    });

    const sp = new URLSearchParams(window.location.search);
    const enquiryIdParam = sp.get("enquiryId");
    const name = sp.get("name");
    const phone = sp.get("phone");
    if (name) setCustomerName(name);
    if (phone) setCustomerPhone(phone.replace(/^91/, ""));
    if (enquiryIdParam) setEnquiryId(enquiryIdParam);

    if (enquiryIdParam) {
      fetch(`/api/admin/enquiries/${encodeURIComponent(enquiryIdParam)}`)
        .then((r) => r.json())
        .then((d) => {
          const enq = d.enquiry;
          if (!enq) return;
          if (enq.customer?.name) setCustomerName(enq.customer.name);
          if (enq.customer?.phone) {
            setCustomerPhone(String(enq.customer.phone).replace(/^91/, ""));
          }
          if (enq.status === "PAID") setBillPaid(true);
          if (enq.invoice?.id) {
            setEditingInvoiceId(enq.invoice.id);
            setError(
              `Editing linked invoice ${enq.invoice.number} — Save updates the same bill & WhatsApp link`
            );
          }
          const nextLines: BillLine[] = (enq.items || []).map(
            (it: {
              quantity: number;
              unitPrice: number;
              product: {
                id: string;
                nameEn: string;
                code: string;
                originalPrice: number;
                offerPrice: number;
                stock: number;
                category?: { slug: string; nameEn: string };
              };
            }) => ({
              id: it.product.id,
              name: it.product.nameEn,
              code: it.product.code,
              originalPrice: it.product.originalPrice,
              offerPrice: it.unitPrice || it.product.offerPrice,
              stock: Math.max(it.product.stock, it.quantity),
              qty: it.quantity,
              categorySlug: it.product.category?.slug || "",
              categoryName: it.product.category?.nameEn || "",
            })
          );
          setLines(nextLines);
        })
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const digits = customerPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      setLoyaltyAvailable(0);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/admin/loyalty?phone=${encodeURIComponent(digits)}`)
        .then((r) => r.json())
        .then((d) => {
          const pts = d.account?.availablePoints ?? 0;
          setLoyaltyAvailable(pts);
          // Default to keep points; cashier can switch to redeem
          if (pts <= 0) setLoyaltyMode("keep");
          if (d.account?.customerName && !customerName) {
            setCustomerName(d.account.customerName);
          }
        })
        .catch(() => setLoyaltyAvailable(0));
    }, 350);
    return () => clearTimeout(t);
  }, [customerPhone, customerName]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (
        categoryFilter !== "ALL" &&
        p.category.slug !== categoryFilter &&
        p.category.nameEn !== categoryFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        p.nameEn.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.category.nameEn.toLowerCase().includes(q)
      );
    });
  }, [query, products, categoryFilter]);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      map.set(p.category.slug, p.category.nameEn);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [products]);

  const byCategory = useMemo(() => {
    const map = new Map<string, CatalogProduct[]>();
    for (const p of filtered) {
      const key = p.category.nameEn;
      const list = map.get(key) || [];
      list.push(p);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const totals = useMemo(
    () =>
      computeBillingTotals({
        items: lines.map((l) => ({
          productId: l.id,
          name: l.name,
          quantity: l.qty,
          originalPrice: l.originalPrice,
          offerPrice: l.offerPrice,
          categorySlug: l.categorySlug,
          categoryName: l.categoryName,
        })),
        offers,
        availableLoyalty: loyaltyAvailable,
        loyaltySettings,
        applyLoyalty: loyaltyMode === "redeem",
      }),
    [lines, offers, loyaltyAvailable, loyaltySettings, loyaltyMode]
  );

  function getQty(id: string) {
    return lines.find((l) => l.id === id)?.qty ?? 0;
  }

  function addProduct(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.id === p.id);
      if (existing) {
        return prev.map((l) =>
          l.id === p.id ? { ...l, qty: Math.min(l.qty + 1, l.stock) } : l
        );
      }
      return [
        ...prev,
        {
          id: p.id,
          name: p.nameEn,
          code: p.code,
          originalPrice: p.originalPrice,
          offerPrice: p.offerPrice,
          stock: p.stock,
          qty: 1,
          categorySlug: p.category.slug,
          categoryName: p.category.nameEn,
        },
      ];
    });
    setError("");
  }

  function updateQty(id: string, qty: number) {
    setLines((prev) =>
      prev
        .map((l) =>
          l.id === id
            ? { ...l, qty: Math.max(0, Math.min(qty, l.stock)) }
            : l
        )
        .filter((l) => l.qty > 0)
    );
  }

  async function saveInvoice() {
    if (lines.length === 0) return;
    setSaving(true);
    setError("");
    const draft = {
      lines: [...lines],
      customerName,
      customerPhone,
      payment,
    };
    try {
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          paymentMethod: payment.toUpperCase(),
          discountType: "NONE",
          discountValue: 0,
          loyaltyRedeem: loyaltyMode === "redeem" ? totals.loyaltyRedeem : 0,
          autoLoyalty: loyaltyMode === "redeem",
          paidAmount: billPaid ? totals.grandTotal : 0,
          awardPoints: billPaid,
          enquiryId: editingInvoiceId ? undefined : enquiryId || undefined,
          invoiceId: editingInvoiceId || undefined,
          idempotencyKey: crypto.randomUUID(),
          items: lines.map((l) => ({
            productId: l.id,
            quantity: l.qty,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Save failed");
        setSaving(false);
        return;
      }
      const inv = data.invoice as SavedInvoice;
      setEditDraft(draft);
      setEditingInvoiceId(inv.id);
      setSavedInvoice({
        ...inv,
        id: inv.id,
        customerName: customerName || inv.customerName,
        customerPhone: customerPhone || inv.customerPhone,
        pointsEarned: inv.pointsEarned ?? totals.pointsEarned,
        orderNumber: data.orderNumber || inv.orderNumber || null,
        enquiryNumber: data.enquiryNumber || inv.enquiryNumber || null,
        items: (inv.items || []).map((it, idx) => {
          const draftLine = draft.lines[idx];
          const mrpLineTotal = draftLine
            ? draftLine.originalPrice * draftLine.qty
            : it.lineTotal;
          return {
            ...it,
            mrpLineTotal,
          };
        }),
      });
      setWhatsappUrl(data.whatsappUrl || "");
      setLines([]);
      setShowBillPopup(true);
      const prod = await fetch("/api/products?pageSize=500&inStock=true").then(
        (r) => r.json()
      );
      setProducts(prod.products || []);
    } catch {
      setError("Network error");
    }
    setSaving(false);
  }

  function openBillPreview() {
    if (!savedInvoice) {
      setError("Save invoice first to view bill");
      return;
    }
    setShowBillPopup(true);
  }

  function printReceipt(mode: "a4" | "thermal") {
    if (!savedInvoice) {
      setError("Save invoice first, then print");
      return;
    }
    setShowBillPopup(true);
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintMode(null), 400);
    }, 100);
  }

  function sendWhatsApp() {
    if (!whatsappUrl) {
      setError("Save invoice first to send WhatsApp bill");
      return;
    }
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  function editBill() {
    if (!editDraft || !savedInvoice) {
      setError("No bill draft to edit");
      return;
    }
    // Restore cart — Save will update the same INV (customer link unchanged)
    setEditingInvoiceId(savedInvoice.id);
    setLines(
      editDraft.lines.map((l) => {
        const live = products.find((p) => p.id === l.id);
        return {
          ...l,
          stock: live?.stock ?? l.stock,
          offerPrice: live?.offerPrice ?? l.offerPrice,
          originalPrice: live?.originalPrice ?? l.originalPrice,
        };
      })
    );
    setCustomerName(editDraft.customerName);
    setCustomerPhone(editDraft.customerPhone);
    setPayment(editDraft.payment);
    setShowBillPopup(false);
    setWhatsappUrl("");
    setError("Edit mode — Save updates the same invoice & WhatsApp link");
  }

  function startNewBill() {
    setShowBillPopup(false);
    setSavedInvoice(null);
    setWhatsappUrl("");
    setEditDraft(null);
    setEditingInvoiceId(null);
    setEnquiryId(null);
    setLines([]);
    setCustomerName("");
    setCustomerPhone("");
    setLoyaltyAvailable(0);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 print:block print:h-auto print:overflow-visible">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-navy sm:text-2xl">
            Billing
          </h1>
          <p className="text-xs text-muted sm:text-sm">
            + / − quantity · discounts auto
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {savedInvoice && (
            <button
              type="button"
              onClick={openBillPreview}
              className="rounded-full bg-success/15 px-3 py-1.5 text-xs font-semibold text-success sm:text-sm"
            >
              View bill · {savedInvoice.number}
            </button>
          )}
          {error && (
            <span className="rounded-full bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger sm:text-sm">
              {error}
            </span>
          )}
        </div>
      </div>

      {offers.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-1.5 print:hidden">
          {offers.map((o, i) => (
            <span
              key={`${o.title}-${i}`}
              className="rounded-full border border-amber/30 bg-amber/10 px-2.5 py-0.5 text-[11px] font-semibold text-navy"
            >
              {o.title}
              {o.percentOff ? ` · ${o.percentOff}%` : ""}
            </span>
          ))}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:overflow-hidden print:hidden">
        <section className="flex min-h-[38vh] flex-col overflow-hidden rounded-2xl border border-border bg-surface p-3 shadow-sm sm:p-4 lg:min-h-0">
          <label className="block shrink-0 text-sm font-bold text-navy">
            Product search
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, code or category…"
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-3 py-2.5 text-sm outline-none focus:border-amber focus:bg-surface"
            />
          </label>
          <div className="mt-2 flex shrink-0 gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoryFilter("ALL")}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
                categoryFilter === "ALL"
                  ? "bg-navy text-white"
                  : "border border-border bg-surface-muted text-navy"
              }`}
            >
              All
            </button>
            {categoryOptions.map(([slug, name]) => (
              <button
                key={slug}
                type="button"
                onClick={() => setCategoryFilter(slug)}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
                  categoryFilter === slug
                    ? "bg-navy text-white"
                    : "border border-border bg-surface-muted text-navy"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
            {byCategory.map(([catName, items]) => (
              <div key={catName}>
                <div className="sticky top-0 z-10 mb-2 flex items-center justify-between rounded-lg bg-navy px-3 py-1.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-white">
                    {catName}
                  </p>
                  <span className="text-[10px] font-semibold text-amber-bright">
                    {items.length} items
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((p) => {
                    const saveAmt = Math.max(0, p.originalPrice - p.offerPrice);
                    const qty = getQty(p.id);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 rounded-xl border border-border/80 px-2.5 py-2"
                      >
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                          <Image
                            src={p.imageUrl || "/images/product-sparklers.png"}
                            alt={p.nameEn}
                            fill
                            className="object-cover"
                            sizes="44px"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-navy">
                            {p.nameEn}
                          </p>
                          <p className="text-[11px] text-muted">
                            {p.code} · Stock {p.stock}
                          </p>
                          <p className="text-[11px]">
                            <span className="font-semibold text-navy">
                              {formatInr(p.offerPrice)}
                            </span>
                            {saveAmt > 0 && (
                              <>
                                <span className="ml-1 text-muted line-through">
                                  {formatInr(p.originalPrice)}
                                </span>
                                <span className="ml-1 text-success">
                                  save {formatInr(saveAmt)}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        {qty === 0 ? (
                          <button
                            type="button"
                            onClick={() => addProduct(p.id)}
                            className="rounded-lg bg-navy px-3 py-2 text-xs font-bold text-white hover:bg-navy-soft"
                          >
                            Add
                          </button>
                        ) : (
                          <QtyStepper
                            value={qty}
                            min={0}
                            max={p.stock}
                            size="sm"
                            onChange={(next) => updateQty(p.id, next)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {byCategory.length === 0 && (
              <p className="text-sm text-muted">No products match your search.</p>
            )}
          </div>
        </section>

        <section className="flex min-h-[52vh] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm lg:min-h-0">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4">
            <div>
              <h2 className="text-sm font-bold text-navy">Checkout</h2>
              <p className="text-[11px] text-muted">
                {lines.length === 0
                  ? "Add products from the left"
                  : `${lines.length} item${lines.length === 1 ? "" : "s"} · MRP ${formatInr(totals.mrpSubtotal)}`}
              </p>
            </div>
            {lines.length > 0 && (
              <button
                type="button"
                onClick={() => setLines([])}
                className="text-xs font-semibold text-danger"
              >
                Clear
              </button>
            )}
          </div>

          {/* Scrollable lines */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {lines.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                No items yet
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {lines.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center gap-2 px-3 py-2.5 sm:px-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy">
                        {l.name}
                      </p>
                    </div>
                    <QtyStepper
                      value={l.qty}
                      min={0}
                      max={l.stock}
                      size="sm"
                      onChange={(next) => updateQty(l.id, next)}
                    />
                    <p className="w-16 shrink-0 text-right text-sm font-bold tabular-nums text-navy">
                      {formatInr(l.originalPrice * l.qty)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Customer + pay + loyalty (compact) */}
          <div className="shrink-0 space-y-2 border-t border-border px-3 py-2.5 sm:px-4">
            <div className="grid grid-cols-2 gap-2">
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name"
                className="rounded-lg border border-border bg-surface-muted px-2.5 py-2 text-sm outline-none focus:border-amber"
              />
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Mobile"
                className="rounded-lg border border-border bg-surface-muted px-2.5 py-2 text-sm outline-none focus:border-amber"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {(["Cash", "UPI", "Card"] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPayment(method)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                    payment === method
                      ? "bg-navy text-white"
                      : "border border-border text-muted"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBillPaid(true)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  billPaid
                    ? "bg-success/20 text-success"
                    : "border border-border text-muted"
                }`}
              >
                Paid · earn pts
              </button>
              <button
                type="button"
                onClick={() => setBillPaid(false)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  !billPaid
                    ? "bg-navy text-white"
                    : "border border-border text-muted"
                }`}
              >
                Unpaid · no pts
              </button>
              {loyaltyAvailable > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setLoyaltyMode((m) => (m === "redeem" ? "keep" : "redeem"))
                  }
                  className={`ml-auto rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
                    loyaltyMode === "redeem"
                      ? "bg-amber/20 text-navy"
                      : "border border-border text-muted"
                  }`}
                >
                  {loyaltyMode === "redeem"
                    ? `Redeem ${loyaltyAvailable} pts`
                    : `Keep ${loyaltyAvailable} pts`}
                </button>
              ) : (
                <span className="ml-auto text-[11px] text-muted">
                  {billPaid
                    ? `+${totals.pointsEarned} pts next bill`
                    : "No pts (unpaid)"}
                </span>
              )}
            </div>
          </div>

          {/* Totals + actions */}
          <div className="shrink-0 border-t border-amber/25 bg-amber/5 px-3 py-3 sm:px-4">
            <div className="space-y-1 text-sm">
              {totals.mrpSubtotal > totals.grandTotal + totals.loyaltyRedeem && (
                <div className="flex justify-between text-muted">
                  <span>MRP</span>
                  <span className="font-semibold tabular-nums line-through text-navy">
                    {formatInr(totals.mrpSubtotal)}
                  </span>
                </div>
              )}
              {totals.productOfferDiscount > 0 && (
                <div className="flex justify-between text-muted">
                  <span>Festival / list price</span>
                  <span className="font-semibold tabular-nums text-navy">
                    {formatInr(totals.subtotal)}
                  </span>
                </div>
              )}
              {totals.promoDiscount > 0 && (
                <div className="flex justify-between font-semibold text-success">
                  <span>Promo offers</span>
                  <span className="tabular-nums">
                    −{formatInr(totals.promoDiscount)}
                  </span>
                </div>
              )}
              {totals.appliedOffers.length > 0 && (
                <ul className="space-y-0.5 text-[11px] text-success">
                  {totals.appliedOffers.map((label) => (
                    <li key={label}>✓ {label}</li>
                  ))}
                </ul>
              )}
              {totals.offerDiscount > 0 && (
                <div className="flex justify-between font-semibold text-success">
                  <span>You save</span>
                  <span className="tabular-nums">
                    −{formatInr(totals.offerDiscount)}
                  </span>
                </div>
              )}
              {totals.loyaltyRedeem > 0 && (
                <div className="flex justify-between text-muted">
                  <span>Loyalty</span>
                  <span className="font-semibold tabular-nums text-navy">
                    −{formatInr(totals.loyaltyRedeem)}
                  </span>
                </div>
              )}
              <div className="flex items-end justify-between border-t border-amber/20 pt-2">
                <div>
                  <p className="text-xs text-muted">You pay</p>
                  <p className="text-2xl font-bold tabular-nums text-navy">
                    {formatInr(totals.grandTotal)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 pb-1">
                  {totals.offerDiscount > 0 && totals.mrpSubtotal > 0 && (
                    <span className="rounded-md bg-danger px-2 py-0.5 text-xs font-bold text-white">
                      {Math.round(
                        (totals.offerDiscount / totals.mrpSubtotal) * 100
                      )}
                      % OFF
                    </span>
                  )}
                  <p className="text-xs font-semibold text-success">
                    {billPaid ? `+${totals.pointsEarned} pts` : "0 pts"}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={lines.length === 0 || saving}
                onClick={saveInvoice}
                className="col-span-3 rounded-xl bg-amber py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-1"
              >
                {saving
                  ? "Saving…"
                  : editingInvoiceId
                    ? "Update invoice"
                    : "Save"}
              </button>
              <button
                type="button"
                onClick={openBillPreview}
                disabled={!savedInvoice}
                className="rounded-xl border border-border bg-surface py-2.5 text-xs font-semibold text-navy disabled:opacity-40"
              >
                Print
              </button>
              <button
                type="button"
                onClick={sendWhatsApp}
                disabled={!whatsappUrl}
                className="rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 py-2.5 text-xs font-semibold text-[#128C7E] disabled:opacity-40"
              >
                WA bill
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Bill preview popup */}
      {showBillPopup && savedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 print:static print:bg-transparent print:p-0">
          <div
            id="billing-print-root"
            className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-xl print:max-h-none print:rounded-none print:shadow-none ${
              printMode === "thermal"
                ? "receipt-thermal-55 max-w-[55mm] font-mono text-[10px] leading-snug"
                : printMode === "a4"
                  ? "receipt-a4 max-w-lg"
                  : "max-w-lg"
            }`}
          >
            <div
              className={`text-navy print:text-black ${
                printMode === "thermal" ? "space-y-2 p-2" : "space-y-4 p-6"
              }`}
            >
              <div className="text-center">
                <p className="receipt-title text-lg font-bold">{shopName}</p>
                <p className="text-sm text-muted print:text-black">Tax invoice</p>
                <p className="mt-1 font-semibold">{savedInvoice.number}</p>
                {savedInvoice.orderNumber && (
                  <p className="text-sm font-semibold print:text-black">
                    {savedInvoice.orderNumber}
                  </p>
                )}
                {savedInvoice.enquiryNumber && (
                  <p className="text-xs text-muted print:text-black">
                    {savedInvoice.enquiryNumber}
                  </p>
                )}
              </div>
              <div className={printMode === "thermal" ? "text-[10px]" : "text-sm"}>
                <p>
                  <span className="text-muted print:text-black">Customer:</span>{" "}
                  {savedInvoice.customerName || "Walk-in"}
                </p>
                <p>
                  <span className="text-muted print:text-black">Phone:</span>{" "}
                  {savedInvoice.customerPhone || "—"}
                </p>
                <p>
                  <span className="text-muted print:text-black">Pay:</span>{" "}
                  {savedInvoice.paymentMethod}
                </p>
              </div>
              <table className="w-full border-t border-b border-border print:border-black">
                <thead>
                  <tr className="text-left text-[9px] uppercase text-muted print:text-black">
                    <th className="py-1 pr-1">Item</th>
                    <th className="py-1">Qty</th>
                    <th className="py-1 text-right">Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {savedInvoice.items.map((it, idx) => (
                    <tr key={idx} className="border-t border-border/50">
                      <td className="max-w-[28mm] break-words py-1 pr-1">
                        {it.name}
                      </td>
                      <td className="py-1 align-top">{it.quantity}</td>
                      <td className="py-1 text-right font-semibold align-top">
                        {formatInr(it.mrpLineTotal ?? it.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                className={`space-y-0.5 text-right ${
                  printMode === "thermal" ? "text-[10px]" : "text-sm"
                }`}
              >
                <p>MRP: {formatInr(savedInvoice.subtotal)}</p>
                {savedInvoice.billDiscount > 0 && (
                  <p className="text-success print:text-black">
                    Disc: −{formatInr(savedInvoice.billDiscount)}
                  </p>
                )}
                {savedInvoice.loyaltyRedeem > 0 && (
                  <p>Loyalty: −{formatInr(savedInvoice.loyaltyRedeem)}</p>
                )}
                <p className="text-success print:text-black">
                  Pts +{savedInvoice.pointsEarned || 0}
                </p>
                <p className="receipt-total text-lg font-bold">
                  Pay: {formatInr(savedInvoice.grandTotal)}
                </p>
              </div>
              {savedInvoice.loyaltyRedeem === 0 && (
                <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted print:hidden">
                  Loyalty redeem is ₹0 when the customer has no points yet (or
                  under {loyaltySettings.minRedemptionPoints} pts). This bill
                  credited +{savedInvoice.pointsEarned || 0} pts for the next
                  visit (1 pt ≈ ₹1 off).
                </p>
              )}
              <p className="text-center text-[9px] text-muted print:text-black">
                Thank you · Sivakasi
              </p>

              <div className="flex flex-wrap gap-2 border-t border-border pt-4 print:hidden">
                <button
                  type="button"
                  onClick={() => printReceipt("a4")}
                  className="rounded-full bg-navy px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Print A4
                </button>
                <button
                  type="button"
                  onClick={() => printReceipt("thermal")}
                  className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-navy"
                >
                  Thermal 55mm
                </button>
                <button
                  type="button"
                  onClick={sendWhatsApp}
                  disabled={!whatsappUrl}
                  className="rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-2.5 text-sm font-semibold text-[#128C7E] disabled:opacity-40"
                >
                  WhatsApp invoice
                  {savedInvoice.orderNumber
                    ? ` + ${savedInvoice.orderNumber}`
                    : ""}
                </button>
                <button
                  type="button"
                  onClick={editBill}
                  className="rounded-full border border-amber/40 bg-amber/10 px-4 py-2.5 text-sm font-semibold text-navy"
                >
                  Edit products / qty
                </button>
                <button
                  type="button"
                  onClick={startNewBill}
                  className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-muted"
                >
                  New bill
                </button>
                <button
                  type="button"
                  onClick={() => setShowBillPopup(false)}
                  className="ml-auto rounded-full px-4 py-2.5 text-sm font-semibold text-muted"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{billPrintCss({ rootId: "billing-print-root", mode: printMode })}</style>
    </div>
  );
}
