"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useShop } from "@/lib/shop-context";
import { fieldErrorsFromZod, useCsrf } from "@/lib/use-csrf";
import { feedbackSchema } from "@/lib/validation";
import {
  PhoneField,
  TextAreaField,
  TextField,
} from "@/components/forms/Fields";

function FeedbackForm() {
  const shop = useShop();
  const { withCsrf, ready } = useCsrf();
  const params = useSearchParams();
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState(
    () => params.get("order") || ""
  );
  const [phone, setPhone] = useState(() => {
    const raw = params.get("phone") || "";
    return raw.replace(/\D/g, "").slice(-10);
  });
  const [rating, setRating] = useState(5);
  const [productQuality, setProductQuality] = useState(5);
  const [packingQuality, setPackingQuality] = useState(5);
  const [staffService, setStaffService] = useState(5);
  const [deliveryExperience, setDeliveryExperience] = useState(5);
  const [comment, setComment] = useState("");
  const [allowPublic, setAllowPublic] = useState(false);

  const ratingFields = useMemo(
    () =>
      [
        ["rating", "Overall rating", rating, setRating],
        ["productQuality", "Product quality", productQuality, setProductQuality],
        ["packingQuality", "Packing quality", packingQuality, setPackingQuality],
        ["staffService", "Staff service", staffService, setStaffService],
        [
          "deliveryExperience",
          "Delivery experience",
          deliveryExperience,
          setDeliveryExperience,
        ],
      ] as const,
    [
      rating,
      productQuality,
      packingQuality,
      staffService,
      deliveryExperience,
    ]
  );

  if (done) {
    return (
      <div className="rounded-3xl border border-border bg-surface p-8 text-center shadow-sm">
        <p className="text-3xl text-success">✓</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
          Thank you
        </h1>
        <p className="mt-2 text-muted">
          Your feedback helps us improve festive deliveries.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4 rounded-3xl border border-border bg-surface p-8 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setFieldErrors({});

        const parsed = feedbackSchema.safeParse({
          orderNumber,
          phone,
          rating,
          productQuality,
          packingQuality,
          staffService,
          deliveryExperience,
          comment: comment || undefined,
          allowPublicDisplay: allowPublic,
        });
        if (!parsed.success) {
          const fe: Record<string, string> = {};
          for (const issue of parsed.error.issues) {
            const key = issue.path.join(".") || "_";
            if (!fe[key]) fe[key] = issue.message;
          }
          setFieldErrors(fe);
          setError("Please fix the highlighted fields");
          setLoading(false);
          return;
        }

        try {
          const init = await withCsrf({
            method: "POST",
            body: JSON.stringify(parsed.data),
          });
          const res = await fetch("/api/feedback", init);
          const data = await res.json();
          setLoading(false);
          if (!res.ok) {
            setError(data?.error?.message || "Could not submit feedback");
            setFieldErrors(fieldErrorsFromZod(data?.error || {}));
            return;
          }
          setDone(true);
        } catch {
          setError("Network error");
          setLoading(false);
        }
      }}
    >
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
        Order feedback
      </h1>
      <p className="text-sm text-muted">
        Rate your {shop.name} experience after delivery.
      </p>

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

      {ratingFields.map(([name, label, value, setValue]) => (
        <label key={name} className="block text-sm font-semibold text-navy">
          {label}
          <select
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            required
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm"
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} / 5
              </option>
            ))}
          </select>
          {fieldErrors[name] && (
            <p className="mt-1 text-xs font-medium text-danger">
              {fieldErrors[name]}
            </p>
          )}
        </label>
      ))}

      <TextAreaField
        label="Comments (optional)"
        name="comment"
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 1000))}
        error={fieldErrors.comment}
        maxLength={1000}
      />

      <label className="flex items-center gap-2 text-sm text-navy">
        <input
          type="checkbox"
          checked={allowPublic}
          onChange={(e) => setAllowPublic(e.target.checked)}
          className="accent-amber"
        />
        Allow public display of this feedback
      </label>

      {error && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !ready}
        className="w-full rounded-full bg-amber py-3.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {loading ? "Submitting…" : "Submit feedback"}
      </button>
    </form>
  );
}

export default function FeedbackPage() {
  return (
    <div className="bg-atmosphere min-h-screen">
      <div className="mx-auto max-w-lg px-4 py-10">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <FeedbackForm />
        </Suspense>
      </div>
    </div>
  );
}
