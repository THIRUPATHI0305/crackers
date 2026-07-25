"use client";

import Link from "next/link";
import { formatInr } from "@/lib/data";
import { useEnquiryCart } from "@/lib/enquiry-cart";
import {
  amountNeededForMinEnquiry,
  meetsMinEnquiryAmount,
  MIN_ENQUIRY_AMOUNT,
} from "@/lib/enquiry-min";
import { CartIcon } from "@/components/QtyStepper";

export function StickyEnquiryBar() {
  const { count, estimated } = useEnquiryCart();
  if (count === 0) return null;

  const minOk = meetsMinEnquiryAmount(estimated);
  const need = amountNeededForMinEnquiry(estimated);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber/15 text-amber">
          <CartIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-navy">
            {count} in cart · {formatInr(estimated)}
          </p>
          <p className="text-xs text-muted">
            {minOk
              ? `Min. ${formatInr(MIN_ENQUIRY_AMOUNT)} met`
              : `Add ${formatInr(need)} more (min ${formatInr(MIN_ENQUIRY_AMOUNT)})`}
          </p>
        </div>
        <Link
          href="/enquiry"
          className="rounded-xl bg-amber px-4 py-2.5 text-sm font-semibold text-white"
        >
          Cart
        </Link>
      </div>
    </div>
  );
}
