"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AdminSearchBar,
  matchesQuery,
} from "@/components/admin/AdminSearchBar";

type ContactMessage = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message: string;
  createdAt: string;
};

export default function AdminContactPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/contact")
      .then((r) => r.json())
      .then((data) => {
        if (data.messages) setMessages(data.messages);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      messages.filter((m) =>
        matchesQuery(q, m.name, m.phone, m.email, m.message)
      ),
    [messages, q]
  );

  if (loading) {
    return <p className="text-sm text-muted">Loading contact messages…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
          Contact messages
        </h1>
        <p className="mt-1 text-sm text-muted">
          {messages.length} message{messages.length === 1 ? "" : "s"} from the
          storefront contact form · newest first
        </p>
      </div>

      <AdminSearchBar
        value={q}
        onChange={setQ}
        placeholder="Search name / phone / email / message…"
      />

      <div className="grid gap-4">
        {filtered.length === 0 && (
          <p className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted">
            {messages.length === 0
              ? "No contact messages yet"
              : "No messages match your search"}
          </p>
        )}
        {filtered.map((m) => (
          <article
            key={m.id}
            className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-navy">{m.name}</h3>
                <p className="mt-1 text-sm text-muted">
                  {m.phone}
                  {m.email ? ` · ${m.email}` : ""}
                </p>
              </div>
              <p className="text-xs text-muted">
                {new Date(m.createdAt).toLocaleString()}
              </p>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-navy">
              {m.message}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`https://wa.me/${
                  m.phone.replace(/\D/g, "").length === 10
                    ? `91${m.phone.replace(/\D/g, "")}`
                    : m.phone.replace(/\D/g, "")
                }`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white"
              >
                Reply on WhatsApp
              </a>
              {m.email ? (
                <a
                  href={`mailto:${m.email}`}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-navy"
                >
                  Reply by email
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
