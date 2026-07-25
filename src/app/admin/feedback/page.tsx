"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AdminSearchBar,
  matchesQuery,
} from "@/components/admin/AdminSearchBar";

type Feedback = {
  id: string;
  rating: number;
  productQuality: number;
  packingQuality: number;
  staffService: number;
  deliveryExperience: number;
  comment: string | null;
  createdAt: string;
  order: {
    number: string;
    customer: { name: string | null };
  };
};

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/admin/feedback")
      .then((r) => r.json())
      .then((data) => {
        if (data.feedback) setFeedback(data.feedback);
      });
  }, []);

  const filtered = useMemo(
    () =>
      feedback.filter((fb) =>
        matchesQuery(
          q,
          fb.order.number,
          fb.order.customer.name,
          fb.comment,
          fb.rating
        )
      ),
    [feedback, q]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
          Customer feedback
        </h1>
        <p className="mt-1 text-sm text-muted">
          Live ratings for quality, packing, service and delivery
        </p>
      </div>

      <AdminSearchBar
        value={q}
        onChange={setQ}
        placeholder="Search order / customer / comment…"
      />

      <div className="grid gap-4">
        {filtered.length === 0 && (
          <p className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted">
            {feedback.length === 0
              ? "No feedback submitted yet"
              : "No feedback matches your search"}
          </p>
        )}
        {filtered.map((fb) => (
          <article
            key={fb.id}
            className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-navy">
                  {fb.order.customer.name || "Customer"}
                </h2>
                <p className="text-sm text-muted">
                  {fb.order.number} ·{" "}
                  {new Date(fb.createdAt).toLocaleDateString()}
                </p>
              </div>
              <p className="text-2xl font-bold text-amber">{fb.rating}/5</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <p>Product {fb.productQuality}/5</p>
              <p>Packing {fb.packingQuality}/5</p>
              <p>Staff {fb.staffService}/5</p>
              <p>Delivery {fb.deliveryExperience}/5</p>
            </div>
            {fb.comment && (
              <p className="mt-3 text-sm text-muted">{fb.comment}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
