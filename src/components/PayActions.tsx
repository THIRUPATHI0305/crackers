"use client";

import { useEffect, useState } from "react";

function isLikelyMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function PayActions({
  upiLink,
  upiId,
  amountLabel,
  payeeName,
}: {
  upiLink: string;
  upiId: string;
  amountLabel: string;
  payeeName: string;
}) {
  const [mobile, setMobile] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMobile(isLikelyMobile());
  }, []);

  async function copyUpi() {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(upiLink)}`;

  return (
    <div className="mt-8 space-y-4">
      {mobile ? (
        <>
          <a
            href={upiLink}
            className="inline-flex w-full items-center justify-center rounded-full bg-amber px-6 py-3.5 text-base font-semibold text-white hover:bg-amber-bright"
          >
            Open UPI app (GPay / PhonePe / Paytm)
          </a>
          <p className="text-xs text-muted">
            This opens your payment app with {amountLabel} prefilled.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-navy">
            Paying from laptop / desktop
          </p>
          <p className="text-xs leading-relaxed text-muted">
            UPI apps only open on a phone. Copy the UPI ID below (or scan the QR
            with GPay / PhonePe / Paytm) and pay {amountLabel} to{" "}
            <strong className="text-navy">{payeeName}</strong>.
          </p>

          <div className="rounded-2xl border border-border bg-surface-muted/60 px-4 py-4 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              UPI ID
            </p>
            <p className="mt-1 break-all font-mono text-lg font-bold text-navy">
              {upiId}
            </p>
            <p className="mt-2 text-sm text-muted">
              Amount: <strong className="text-navy">{amountLabel}</strong>
            </p>
            <button
              type="button"
              onClick={copyUpi}
              className="mt-3 w-full rounded-full bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-soft"
            >
              {copied ? "UPI ID copied" : "Copy UPI ID"}
            </button>
          </div>

          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrSrc}
              alt="UPI payment QR"
              width={220}
              height={220}
              className="rounded-2xl border border-border bg-white p-2"
            />
            <p className="text-xs text-muted">Scan with any UPI app on your phone</p>
          </div>

          <a
            href={upiLink}
            className="inline-flex w-full items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-semibold text-navy hover:bg-surface-muted"
          >
            Try open UPI link anyway
          </a>
        </>
      )}

      {/* Always show UPI ID for sharing / fallback */}
      <div className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted">
        UPI ID: <span className="font-mono font-semibold text-navy">{upiId}</span>
        {" · "}
        {amountLabel}
      </div>
    </div>
  );
}
