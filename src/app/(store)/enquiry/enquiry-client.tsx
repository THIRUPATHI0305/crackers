"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { discountPercent, formatInr } from "@/lib/data";
import { useEnquiryCart } from "@/lib/enquiry-cart";
import { fieldErrorsFromZod, useCsrf } from "@/lib/use-csrf";
import { enquiryDraftSchema } from "@/lib/validation";
import { CartIcon, QtyStepper, TrashIcon } from "@/components/QtyStepper";
import {
  PhoneField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/forms/Fields";
import { OtpVerifyBlock } from "@/components/forms/OtpVerifyBlock";
import {
  amountNeededForMinEnquiry,
  meetsMinEnquiryAmount,
  MIN_ENQUIRY_AMOUNT,
} from "@/lib/enquiry-min";
import {
  computeBillingTotals,
  type BillingOffer,
} from "@/lib/billing-calc";

export default function EnquiryClient({
  loyalty,
}: {
  loyalty: {
    enabled: boolean;
    pointsPerHundred: number;
    maxDiscountPercent: number;
    maxLoyaltyDiscountAmount: number;
    minRedemptionPoints: number;
  };
}) {
  const { withCsrf, ready: csrfReady } = useCsrf();
  const {
    items,
    estimated,
    mrpTotal,
    setQuantity,
    removeItem,
    replaceItems,
    clear,
    count,
  } = useEnquiryCart();

  const [promoOffers, setPromoOffers] = useState<BillingOffer[]>([]);

  useEffect(() => {
    fetch("/api/offers")
      .then((r) => r.json())
      .then((d) => {
        setPromoOffers(
          (d.offers || []).map(
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
      })
      .catch(() => setPromoOffers([]));
  }, []);

  const billingTotals = useMemo(
    () =>
      computeBillingTotals({
        items: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          originalPrice: i.originalPrice,
          offerPrice: i.price,
          categorySlug: i.categorySlug || "",
          categoryName: "",
        })),
        offers: promoOffers,
        availableLoyalty: 0,
        loyaltySettings: {
          pointsPerHundred: loyalty.pointsPerHundred,
          minRedemptionPoints: loyalty.minRedemptionPoints,
          maxDiscountPercent: loyalty.maxDiscountPercent,
          maxLoyaltyDiscountAmount: loyalty.maxLoyaltyDiscountAmount,
          enabled: loyalty.enabled,
        },
        applyLoyalty: false,
      }),
    [items, promoOffers, loyalty]
  );

  /** Catalogue offer subtotal − combo/category/flat/percent promos */
  const afterPromo = billingTotals.grandTotal;
  const promoDiscount = billingTotals.promoDiscount;
  const appliedPromos = billingTotals.appliedOffers;

  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [areaOptions, setAreaOptions] = useState<string[]>([]);
  const [pincode, setPincode] = useState("");
  const [pincodeHint, setPincodeHint] = useState("");
  const [lookingUpPin, setLookingUpPin] = useState(false);
  const [note, setNote] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const lastLookedUpPin = useRef("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [enquiryNumber, setEnquiryNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [availablePoints, setAvailablePoints] = useState(0);
  const [redeemLoyalty, setRedeemLoyalty] = useState(false);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);

  const minOk = meetsMinEnquiryAmount(afterPromo);
  const amountNeeded = amountNeededForMinEnquiry(afterPromo);
  const totalSaved = Math.max(0, mrpTotal - afterPromo);

  const maxRedeemable = useMemo(() => {
    if (!loyalty.enabled || availablePoints <= 0) return 0;
    const maxByPercent = Math.floor(
      (afterPromo * loyalty.maxDiscountPercent) / 100
    );
    const maxAllowed = Math.min(
      availablePoints,
      loyalty.maxLoyaltyDiscountAmount,
      maxByPercent,
      Math.floor(afterPromo)
    );
    return maxAllowed >= loyalty.minRedemptionPoints ? maxAllowed : 0;
  }, [loyalty, availablePoints, afterPromo]);

  const loyaltyRedeem = redeemLoyalty ? maxRedeemable : 0;
  const payable = Math.max(0, afterPromo - loyaltyRedeem);

  const loyaltyPointsEarn =
    loyalty.enabled && loyalty.pointsPerHundred > 0
      ? Math.floor((payable / 100) * loyalty.pointsPerHundred)
      : 0;

  // Load loyalty balance when mobile is complete
  useEffect(() => {
    const digits = phone.replace(/\D/g, "");
    if (!loyalty.enabled || digits.length !== 10 || !csrfReady) {
      setAvailablePoints(0);
      setRedeemLoyalty(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoyaltyLoading(true);
      try {
        const init = await withCsrf({
          method: "POST",
          body: JSON.stringify({ phone: digits }),
        });
        const res = await fetch("/api/loyalty/balance", init);
        const data = await res.json();
        if (!cancelled && res.ok) {
          setAvailablePoints(data.availablePoints ?? 0);
        }
      } catch {
        if (!cancelled) setAvailablePoints(0);
      } finally {
        if (!cancelled) setLoyaltyLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [phone, loyalty.enabled, csrfReady, withCsrf]);

  useEffect(() => {
    if (maxRedeemable <= 0) setRedeemLoyalty(false);
  }, [maxRedeemable]);

  // Refresh stale cart IDs after catalogue reseed (match by slug)
  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    (async () => {
      const next: typeof items = [];
      let changed = false;
      let dropped = 0;
      for (const item of items) {
        try {
          const res = await fetch(`/api/products/${item.slug}`);
          if (!res.ok) {
            dropped += 1;
            changed = true;
            continue;
          }
          const data = await res.json();
          const p = data?.product;
          if (!p?.id) {
            dropped += 1;
            changed = true;
            continue;
          }
          if (
            p.id !== item.productId ||
            p.offerPrice !== item.price ||
            p.originalPrice !== item.originalPrice
          ) {
            changed = true;
          }
          next.push({
            ...item,
            productId: p.id,
            name: p.nameEn || p.name || item.name,
            image: p.imageUrl || item.image,
            price: typeof p.offerPrice === "number" ? p.offerPrice : item.price,
            originalPrice:
              typeof p.originalPrice === "number"
                ? p.originalPrice
                : item.originalPrice,
            maxStock: typeof p.stock === "number" ? p.stock : item.maxStock,
          });
        } catch {
          dropped += 1;
          changed = true;
        }
      }
      if (cancelled || !changed) return;
      replaceItems(next);
      if (dropped > 0) {
        setError(
          `${dropped} item${dropped === 1 ? "" : "s"} removed — no longer available. Add products again if needed.`
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.slug).join("|")]);

  // Tamil Nadu pincode → read-only city + area dropdown
  useEffect(() => {
    if (pincode.length !== 6) {
      setLookingUpPin(false);
      setPincodeHint("");
      setCity("");
      setArea("");
      setAreaOptions([]);
      lastLookedUpPin.current = "";
      return;
    }
    if (lastLookedUpPin.current === pincode) return;

    let cancelled = false;
    const t = window.setTimeout(async () => {
      setLookingUpPin(true);
      setPincodeHint("");
      setCity("");
      setArea("");
      setAreaOptions([]);
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.pincode;
        delete next.city;
        delete next.area;
        return next;
      });
      try {
        const res = await fetch(`/api/pincode/${pincode}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          const msg =
            data?.error?.message ||
            "Enter a valid Tamil Nadu pincode";
          setPincodeHint(msg);
          setFieldErrors((prev) => ({ ...prev, pincode: msg }));
          setLookingUpPin(false);
          return;
        }
        lastLookedUpPin.current = pincode;
        const areas: string[] = Array.isArray(data.areas) ? data.areas : [];
        setCity(data.city || "");
        setAreaOptions(areas);
        setArea(areas[0] || data.area || "");
        setPincodeHint(`${data.city}, Tamil Nadu`);
      } catch {
        if (!cancelled) {
          setPincodeHint("Could not look up pincode");
          setFieldErrors((prev) => ({
            ...prev,
            pincode: "Could not look up pincode",
          }));
        }
      } finally {
        if (!cancelled) setLookingUpPin(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [pincode]);


  const draftPayload = useMemo(
    () => ({
      name,
      phone,
      email,
      whatsapp: whatsapp || phone,
      city,
      area: area || "",
      pincode: pincode || "",
      note: note || "",
      language: "en" as const,
      preferredContact: "WHATSAPP" as const,
      clientRequestId: undefined as string | undefined,
      items: items.map((c) => ({
        productId: c.productId,
        slug: c.slug,
        quantity: c.quantity,
      })),
    }),
    [name, phone, email, whatsapp, city, area, pincode, note, items]
  );

  async function requestOtp() {
    setError("");
    setFieldErrors({});
    if (!meetsMinEnquiryAmount(afterPromo)) {
      setError(
        `Minimum order is ${formatInr(MIN_ENQUIRY_AMOUNT)}. Add ${formatInr(amountNeededForMinEnquiry(afterPromo))} more to continue.`
      );
      return null;
    }
    const parsed = enquiryDraftSchema.safeParse(draftPayload);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "_";
        if (!fe[key]) fe[key] = issue.message;
      }
      setFieldErrors(fe);
      setError("Please fix the highlighted fields before sending OTP");
      return null;
    }

    try {
      const init = await withCsrf({
        method: "POST",
        body: JSON.stringify({
          phone: parsed.data.phone,
          email: parsed.data.email,
          purpose: "ENQUIRY",
        }),
      });
      const res = await fetch("/api/otp/send", init);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Could not send OTP");
        setFieldErrors(fieldErrorsFromZod(data?.error || {}));
        return null;
      }
      setOtpSent(true);
      return {
        challengeId: data.challengeId as string,
        debugCode: data.debugCode as string | undefined,
        expiresInSeconds: data.expiresInSeconds as number | undefined,
        resendAfterSeconds: data.resendAfterSeconds as number | undefined,
        delivery: data.delivery as
          | { ok: boolean; channel: string; message: string }
          | undefined,
      };
    } catch {
      setError("Network error sending OTP");
      return null;
    }
  }

  async function submitEnquiry(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setFieldErrors({});

    const draft = enquiryDraftSchema.safeParse(draftPayload);
    if (!draft.success) {
      const fe: Record<string, string> = {};
      for (const issue of draft.error.issues) {
        const key = issue.path.join(".") || "_";
        if (!fe[key]) fe[key] = issue.message;
      }
      setFieldErrors(fe);
      setError("Please fix the highlighted fields");
      setLoading(false);
      return;
    }
    if (!meetsMinEnquiryAmount(afterPromo)) {
      setError(
        `Minimum order is ${formatInr(MIN_ENQUIRY_AMOUNT)}. Add ${formatInr(amountNeeded)} more to continue.`
      );
      setLoading(false);
      return;
    }
    if (!challengeId) {
      setFieldErrors({ otp: "Send OTP first" });
      setError("Verify your email with OTP before submitting");
      setLoading(false);
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setFieldErrors({ otp: "Enter the 6-digit OTP" });
      setError("Enter a valid 6-digit OTP");
      setLoading(false);
      return;
    }

    try {
      const init = await withCsrf({
        method: "POST",
        body: JSON.stringify({
          ...draft.data,
          area: draft.data.area || undefined,
          pincode: draft.data.pincode || undefined,
          note: draft.data.note || undefined,
          clientRequestId: crypto.randomUUID(),
          otpChallengeId: challengeId,
          otp,
          loyaltyRedeem,
        }),
      });
      const res = await fetch("/api/enquiries", init);
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error?.message || "Submit failed";
        setError(msg);
        const fe = fieldErrorsFromZod(data?.error || {});
        if (!fe.otp && /otp/i.test(msg)) fe.otp = msg;
        setFieldErrors(fe);
        setLoading(false);
        return;
      }
      setEnquiryNumber(data.enquiryNumber);
      clear();
      setSubmitted(true);
      setRedeemLoyalty(false);
      setAvailablePoints(0);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="bg-atmosphere flex min-h-[70vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg rounded-3xl border border-border bg-surface p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-2xl text-success">
            ✓
          </div>
          <h1 className="mt-5 font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
            Enquiry submitted
          </h1>
          <p className="mt-2 text-sm text-muted">
            Enquiry number{" "}
            <span className="font-bold text-navy">{enquiryNumber}</span>
          </p>
          <p className="mt-2 text-xs text-muted">
            Email verified via OTP. Loyalty points for this order are added when
            the shop marks your enquiry as PAID.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/products"
              className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-navy"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-atmosphere min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-amber">
              Your cart
            </p>
            <h1 className="mt-1 flex items-center gap-2 font-[family-name:var(--font-display)] text-4xl font-semibold text-navy">
              <CartIcon className="h-8 w-8" />
              Cart
            </h1>
            <p className="mt-2 text-muted">
              Minimum order {formatInr(MIN_ENQUIRY_AMOUNT)}. Verify email with
              OTP, then submit. No payment online.
            </p>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => clear()}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/5"
            >
              <TrashIcon className="h-4 w-4" />
              Clear cart
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-border bg-surface p-10 text-center">
            <CartIcon className="mx-auto h-10 w-10 text-muted" />
            <p className="mt-4 text-navy">Your cart is empty.</p>
            <Link
              href="/products"
              className="mt-4 inline-flex rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-white"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <p className="text-sm text-muted">
                {count} item{count === 1 ? "" : "s"} in cart
              </p>
              {items.map((item) => {
                const mrp = item.originalPrice || item.price;
                const off = discountPercent(mrp, item.price);
                const lineOffer = item.price * item.quantity;
                return (
                  <div
                    key={item.productId}
                    className="flex gap-4 rounded-2xl border border-border bg-surface p-4"
                  >
                    <Link
                      href={`/products/${item.slug}`}
                      className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-white"
                    >
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-contain p-1"
                        sizes="96px"
                      />
                      {off > 0 && (
                        <span className="absolute left-1.5 top-1.5 rounded-md bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {off}% OFF
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/products/${item.slug}`}
                          className="font-semibold text-navy hover:underline"
                        >
                          {item.name}
                        </Link>
                        <button
                          type="button"
                          aria-label={`Remove ${item.name}`}
                          onClick={() => removeItem(item.productId)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-danger transition hover:bg-danger/10"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <QtyStepper
                          value={item.quantity}
                          min={0}
                          max={item.maxStock ?? 999}
                          onChange={(next) => setQuantity(item.productId, next)}
                        />
                        <div className="text-right">
                          <div className="flex items-baseline justify-end gap-2">
                            {mrp > item.price && (
                              <span className="text-sm text-muted line-through">
                                {formatInr(mrp * item.quantity)}
                              </span>
                            )}
                            <span className="text-lg font-bold text-navy">
                              {formatInr(lineOffer)}
                            </span>
                          </div>
                          {item.quantity > 1 && (
                            <p className="mt-0.5 text-xs text-muted">
                              {formatInr(item.price)} × {item.quantity}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <Link
                href="/products"
                className="inline-flex text-sm font-semibold text-navy underline-offset-4 hover:underline"
              >
                ← Continue shopping
              </Link>
            </div>

            <form
              className="h-fit space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm"
              onSubmit={submitEnquiry}
            >
              <div className="space-y-2 rounded-xl bg-surface-muted/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Estimated total
                </p>
                {mrpTotal > afterPromo && (
                  <div className="flex items-center justify-between text-sm text-muted">
                    <span>MRP</span>
                    <span className="line-through">{formatInr(mrpTotal)}</span>
                  </div>
                )}
                {estimated < mrpTotal && (
                  <div className="flex items-center justify-between text-sm text-muted">
                    <span>Festival / list price</span>
                    <span>{formatInr(estimated)}</span>
                  </div>
                )}
                {promoDiscount > 0 && (
                  <div className="flex items-center justify-between text-sm font-semibold text-success">
                    <span>Promo offers</span>
                    <span>−{formatInr(promoDiscount)}</span>
                  </div>
                )}
                {appliedPromos.length > 0 && (
                  <ul className="space-y-0.5 text-[11px] text-success">
                    {appliedPromos.map((label) => (
                      <li key={label}>✓ {label}</li>
                    ))}
                  </ul>
                )}
                {totalSaved > 0 && (
                  <div className="flex items-center justify-between text-sm font-semibold text-success">
                    <span>You save</span>
                    <span>−{formatInr(totalSaved)}</span>
                  </div>
                )}
                <div className="flex items-end justify-between gap-2">
                  <p className="text-2xl font-bold text-navy">
                    {formatInr(payable)}
                  </p>
                  {totalSaved > 0 && (
                    <span className="rounded-md bg-danger px-2 py-0.5 text-xs font-bold text-white">
                      {discountPercent(mrpTotal, afterPromo)}% OFF
                    </span>
                  )}
                </div>
                {loyaltyRedeem > 0 && (
                  <div className="flex items-center justify-between text-sm font-semibold text-success">
                    <span>Loyalty redeem</span>
                    <span>−{formatInr(loyaltyRedeem)}</span>
                  </div>
                )}
                {!minOk ? (
                  <p className="rounded-lg bg-amber/10 px-3 py-2 text-xs font-semibold text-amber">
                    Minimum order {formatInr(MIN_ENQUIRY_AMOUNT)}. Add{" "}
                    {formatInr(amountNeeded)} more to submit enquiry.
                  </p>
                ) : (
                  <p className="text-xs font-medium text-success">
                    Minimum order {formatInr(MIN_ENQUIRY_AMOUNT)} met
                  </p>
                )}
                {loyalty.enabled && (
                  <div className="space-y-2 border-t border-border/60 pt-2">
                    {loyaltyLoading ? (
                      <p className="text-xs text-muted">Checking loyalty…</p>
                    ) : availablePoints > 0 && maxRedeemable > 0 ? (
                      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-amber"
                          checked={redeemLoyalty}
                          onChange={(e) => setRedeemLoyalty(e.target.checked)}
                        />
                        <span className="text-xs text-navy">
                          <span className="font-bold">
                            Redeem {maxRedeemable} pts
                          </span>{" "}
                          (−{formatInr(maxRedeemable)}) now
                          <span className="mt-0.5 block text-muted">
                            You have {availablePoints} pts · max{" "}
                            {loyalty.maxDiscountPercent}% of cart
                          </span>
                        </span>
                      </label>
                    ) : availablePoints > 0 ? (
                      <p className="text-xs text-muted">
                        {availablePoints} pts available — need at least{" "}
                        {loyalty.minRedemptionPoints} pts eligible on this cart
                      </p>
                    ) : phone.replace(/\D/g, "").length === 10 ? (
                      <p className="text-xs text-muted">
                        No loyalty points on this mobile yet
                      </p>
                    ) : (
                      <p className="text-xs text-muted">
                        Enter mobile to check redeemable points
                      </p>
                    )}
                    <p className="text-xs text-navy">
                      {loyaltyPointsEarn > 0 ? (
                        <>
                          After admin marks{" "}
                          <span className="font-bold">PAID</span>, earn about{" "}
                          <span className="font-bold text-amber">
                            {loyaltyPointsEarn} pt
                            {loyaltyPointsEarn === 1 ? "" : "s"}
                          </span>{" "}
                          for next bill ({loyalty.pointsPerHundred} pt / ₹100)
                        </>
                      ) : (
                        <>
                          Points are added when admin marks this enquiry{" "}
                          <span className="font-bold">PAID</span>
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>

              <p className="text-sm font-bold text-navy">Customer details</p>
              <TextField
                label="Full name *"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 30))}
                error={fieldErrors.name}
                autoComplete="name"
                maxLength={30}
              />
              <PhoneField
                label="Mobile number *"
                value={phone}
                onChange={(v) => {
                  setPhone(v);
                  setOtpSent(false);
                  setChallengeId("");
                  setOtp("");
                }}
                error={fieldErrors.phone}
                required
              />
              <TextField
                label="Email *"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value.slice(0, 120));
                  setOtpSent(false);
                  setChallengeId("");
                  setOtp("");
                }}
                error={fieldErrors.email}
                autoComplete="email"
                maxLength={120}
                placeholder="OTP will be sent here"
                required
              />
              <PhoneField
                label="WhatsApp (optional)"
                value={whatsapp}
                onChange={setWhatsapp}
                error={fieldErrors.whatsapp}
                placeholder="Same as mobile if empty"
              />
              <TextField
                label="Pincode (Tamil Nadu) *"
                value={pincode}
                onChange={(e) =>
                  setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                error={fieldErrors.pincode}
                inputMode="numeric"
                maxLength={6}
                autoComplete="postal-code"
                placeholder="6-digit TN pincode"
                required
              />
              {lookingUpPin ? (
                <p className="text-xs text-muted">Looking up Tamil Nadu address…</p>
              ) : pincodeHint && !fieldErrors.pincode ? (
                <p className="text-xs text-success">{pincodeHint}</p>
              ) : null}
              {city ? (
                <TextField
                  label="City *"
                  value={city}
                  readOnly
                  maxLength={80}
                  error={fieldErrors.city}
                  className="cursor-not-allowed bg-surface-muted/80 text-navy"
                />
              ) : null}
              {areaOptions.length > 0 ? (
                <SelectField
                  label="Area *"
                  value={area}
                  onChange={(e) => setArea(e.target.value.slice(0, 80))}
                  error={fieldErrors.area}
                  required
                >
                  {areaOptions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </SelectField>
              ) : null}
              <TextAreaField
                label="Note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                error={fieldErrors.note}
                maxLength={500}
              />

              <OtpVerifyBlock
                ready={
                  minOk &&
                  phone.length === 10 &&
                  email.includes("@") &&
                  !!city &&
                  !!area &&
                  pincode.length === 6
                }
                csrfReady={csrfReady}
                onSend={requestOtp}
                otp={otp}
                onOtpChange={setOtp}
                challengeId={challengeId}
                onChallengeId={setChallengeId}
                error={fieldErrors.otp}
                challengeError={fieldErrors.otpChallengeId}
              />

              {error && (
                <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={
                  loading ||
                  items.length === 0 ||
                  !minOk ||
                  !otpSent ||
                  !challengeId ||
                  otp.length !== 6
                }
                className="w-full rounded-full bg-amber py-3.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {loading
                  ? "Submitting…"
                  : !minOk
                    ? `Add ${formatInr(amountNeeded)} more`
                    : "Verify OTP & submit enquiry"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
