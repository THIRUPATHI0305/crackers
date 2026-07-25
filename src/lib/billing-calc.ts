export type BillingCartItem = {
  productId: string;
  name: string;
  quantity: number;
  originalPrice: number;
  offerPrice: number;
  categorySlug: string;
  categoryName: string;
};

export type BillingOffer = {
  type: string;
  title: string;
  percentOff: number | null;
  fixedOff: number | null;
  /** Category slugs this offer applies to (CATEGORY type) */
  categorySlugs?: string[];
  /** Product ids for COMBO — discount when all are in the cart */
  productIds?: string[];
};

export type LoyaltySettings = {
  pointsPerHundred: number;
  minRedemptionPoints: number;
  maxDiscountPercent: number;
  maxLoyaltyDiscountAmount: number;
  enabled: boolean;
};

export type BillingTotals = {
  mrpSubtotal: number;
  subtotal: number;
  productOfferDiscount: number;
  promoDiscount: number;
  offerDiscount: number;
  loyaltyRedeem: number;
  grandTotal: number;
  pointsEarned: number;
  appliedOffers: string[];
};

function dedupeOffers(offers: BillingOffer[]): BillingOffer[] {
  const seen = new Set<string>();
  const out: BillingOffer[] = [];
  for (const o of offers) {
    const key = `${o.type}|${o.title}|${o.percentOff ?? 0}|${o.fixedOff ?? 0}|${(o.categorySlugs || []).join(",")}|${(o.productIds || []).join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}

export function computeBillingTotals(opts: {
  items: BillingCartItem[];
  offers: BillingOffer[];
  availableLoyalty: number;
  loyaltySettings: LoyaltySettings;
  applyLoyalty?: boolean;
  requestedLoyalty?: number;
}): BillingTotals {
  const {
    items,
    availableLoyalty,
    loyaltySettings,
    applyLoyalty = true,
    requestedLoyalty,
  } = opts;
  const offers = dedupeOffers(opts.offers);

  const mrpSubtotal = items.reduce(
    (s, i) => s + i.originalPrice * i.quantity,
    0
  );
  const subtotal = items.reduce((s, i) => s + i.offerPrice * i.quantity, 0);
  const productOfferDiscount = Math.max(0, mrpSubtotal - subtotal);

  let promoDiscount = 0;
  const appliedOffers: string[] = [];
  let festivalApplied = false;

  for (const offer of offers) {
    const pct = offer.percentOff ?? 0;
    const fixed = offer.fixedOff ?? 0;
    const type = offer.type.toUpperCase();

    if (type === "BUY_MORE" || offer.title.toLowerCase().includes("buy more")) {
      if (subtotal >= 5000 && pct > 0) {
        const extra = Math.round((subtotal * pct) / 100);
        promoDiscount += extra;
        appliedOffers.push(`${offer.title} (−${pct}%)`);
      }
      continue;
    }

    if (type === "COMBO") {
      const ids = offer.productIds || [];
      if (ids.length < 2) continue;
      // Combo only when every listed product is in the cart with the same qty.
      // Unequal qty (e.g. 1 + 2) = not a combo — no extra promo.
      const qtys = ids.map(
        (id) => items.find((i) => i.productId === id)?.quantity ?? 0
      );
      if (qtys.some((q) => q < 1)) continue;
      const setQty = qtys[0]!;
      if (!qtys.every((q) => q === setQty)) continue;

      const byId = new Map(items.map((i) => [i.productId, i]));
      const base = ids.reduce((s, id) => {
        const item = byId.get(id);
        return item ? s + item.offerPrice * setQty : s;
      }, 0);
      if (base <= 0) continue;
      if (pct > 0) {
        const extra = Math.round((base * pct) / 100);
        promoDiscount += extra;
        appliedOffers.push(
          `${offer.title} (−${pct}% × ${setQty} set${setQty > 1 ? "s" : ""})`
        );
      } else if (fixed > 0) {
        const extra = Math.min(fixed * setQty, base);
        promoDiscount += extra;
        appliedOffers.push(
          `${offer.title} (−₹${fixed} × ${setQty} set${setQty > 1 ? "s" : ""})`
        );
      }
      continue;
    }

    if (type === "CATEGORY" || type === "CATEGORY_WIDE") {
      const slugs = offer.categorySlugs || [];
      const eligible =
        slugs.length === 0
          ? []
          : items.filter((i) => slugs.includes(i.categorySlug));
      const base = eligible.reduce((s, i) => s + i.offerPrice * i.quantity, 0);
      if (base <= 0) continue;
      if (pct > 0) {
        const extra = Math.round((base * pct) / 100);
        promoDiscount += extra;
        appliedOffers.push(`${offer.title} (−${pct}% on category)`);
      } else if (fixed > 0) {
        promoDiscount += Math.min(fixed, base);
        appliedOffers.push(`${offer.title} (−₹${fixed} on category)`);
      }
      continue;
    }

    if (type === "FLAT" && fixed > 0) {
      promoDiscount += Math.min(fixed, subtotal);
      appliedOffers.push(`${offer.title} (−₹${fixed})`);
      continue;
    }

    // FESTIVAL / ADVERTISEMENT = catalogue list price already (offerPrice).
    // Do not stack again as a bill promo.
    if (type === "FESTIVAL" || type === "ADVERTISEMENT") {
      continue;
    }

    // PERCENT = extra bill-wide promo on top of offer prices.
    if (type === "PERCENT" && pct > 0 && !festivalApplied) {
      const extra = Math.round((subtotal * pct) / 100);
      promoDiscount += extra;
      appliedOffers.push(`${offer.title} (−${pct}%)`);
      festivalApplied = true;
      continue;
    }
  }

  promoDiscount = Math.min(promoDiscount, Math.round(subtotal * 0.9));
  const offerDiscount = productOfferDiscount + promoDiscount;
  const afterOffers = Math.max(0, mrpSubtotal - offerDiscount);

  let loyaltyRedeem = 0;
  if (loyaltySettings.enabled && applyLoyalty && availableLoyalty > 0) {
    const maxByPercent = Math.floor(
      (afterOffers * loyaltySettings.maxDiscountPercent) / 100
    );
    const maxAllowed = Math.min(
      availableLoyalty,
      loyaltySettings.maxLoyaltyDiscountAmount,
      maxByPercent,
      afterOffers
    );
    const minPts = Math.max(0, loyaltySettings.minRedemptionPoints);
    if (maxAllowed >= minPts && maxAllowed > 0) {
      loyaltyRedeem =
        requestedLoyalty != null && requestedLoyalty > 0
          ? Math.min(requestedLoyalty, maxAllowed)
          : maxAllowed;
    }
  }

  const grandTotal = Math.max(0, afterOffers - loyaltyRedeem);
  const pointsEarned =
    loyaltySettings.pointsPerHundred > 0
      ? Math.floor((grandTotal / 100) * loyaltySettings.pointsPerHundred)
      : 0;

  return {
    mrpSubtotal,
    subtotal,
    productOfferDiscount,
    promoDiscount,
    offerDiscount,
    loyaltyRedeem,
    grandTotal,
    pointsEarned,
    appliedOffers,
  };
}
