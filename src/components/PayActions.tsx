"use client";

import { useEffect, useState } from "react";

function isLikelyMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

type AppLinks = {
  upi: string;
  gpay: string;
  phonepe: string;
  paytm: string;
};

export function PayActions({
  links,
  amountLabel,
  payeeName,
}: {
  links: AppLinks;
  amountLabel: string;
  payeeName: string;
}) {
  const [mobile, setMobile] = useState(false);
  const [preferred, setPreferred] = useState<"gpay" | "phonepe" | "paytm" | "upi">(
    "upi"
  );

  useEffect(() => {
    setMobile(isLikelyMobile());
  }, []);

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(links.upi)}`;

  const openHref =
    preferred === "gpay"
      ? links.gpay
      : preferred === "phonepe"
        ? links.phonepe
        : preferred === "paytm"
          ? links.paytm
          : links.upi;

  return (
    <div className="mt-8 space-y-5 text-left">
      <p className="text-center text-xs leading-relaxed text-muted">
        Open your payment app — amount {amountLabel} is filled for{" "}
        <strong className="text-navy">{payeeName}</strong>. You do not need to
        type any UPI ID.
      </p>

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { id: "gpay" as const, label: "GPay" },
            { id: "phonepe" as const, label: "PhonePe" },
            { id: "paytm" as const, label: "Paytm" },
          ] as const
        ).map((app) => (
          <button
            key={app.id}
            type="button"
            onClick={() => setPreferred(app.id)}
            className={`rounded-full px-2 py-2.5 text-sm font-semibold transition ${
              preferred === app.id
                ? "bg-navy text-white"
                : "border border-border bg-surface text-navy hover:bg-surface-muted"
            }`}
          >
            {app.label}
          </button>
        ))}
      </div>

      <a
        href={openHref}
        className="inline-flex w-full items-center justify-center rounded-full bg-amber px-6 py-3.5 text-center text-base font-semibold text-white hover:bg-amber-bright"
      >
        {preferred === "gpay"
          ? "Open Google Pay"
          : preferred === "phonepe"
            ? "Open PhonePe"
            : preferred === "paytm"
              ? "Open Paytm"
              : "Open UPI app"}
      </a>

      <a
        href={links.upi}
        className="inline-flex w-full items-center justify-center rounded-full border border-border px-6 py-2.5 text-sm font-semibold text-navy hover:bg-surface-muted"
      >
        Any UPI app
      </a>

      {!mobile ? (
        <div className="flex flex-col items-center gap-2 pt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt="Scan to pay with any UPI app"
            width={220}
            height={220}
            className="rounded-2xl border border-border bg-white p-2"
          />
          <p className="text-center text-xs text-muted">
            On laptop: scan this QR with GPay / PhonePe / Paytm
          </p>
        </div>
      ) : null}

      <p className="rounded-xl border border-dashed border-border px-3 py-2 text-center text-[11px] leading-relaxed text-muted">
        Automatic “payment request” notifications into GPay / PhonePe / Paytm
        need a business payment gateway (e.g. Razorpay). This page opens your
        app directly to pay instead — no UPI ID typing.
      </p>
    </div>
  );
}
