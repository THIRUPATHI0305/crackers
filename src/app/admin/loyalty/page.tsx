"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AdminSearchBar,
  matchesQuery,
} from "@/components/admin/AdminSearchBar";

type Account = {
  id: string;
  phone: string;
  availablePoints: number;
  earnedPoints: number;
  redeemedPoints: number;
  customer: { name: string | null };
  transactions: { createdAt: string }[];
};

export default function AdminLoyaltyPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rules, setRules] = useState({
    pointsPerHundred: 1,
    minRedemptionPoints: 1,
    maxDiscountPercent: 30,
  });
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(true);
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [points, setPoints] = useState(10);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  async function load() {
    const [loy, settings] = await Promise.all([
      fetch("/api/admin/loyalty"),
      fetch("/api/admin/settings"),
    ]);
    const loyData = await loy.json();
    const setData = await settings.json();
    if (loy.ok) setAccounts(loyData.accounts || []);
    if (settings.ok && setData.loyalty) {
      setRules({
        pointsPerHundred: setData.loyalty.pointsPerHundred,
        minRedemptionPoints: setData.loyalty.minRedemptionPoints,
        maxDiscountPercent: setData.loyalty.maxDiscountPercent,
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function adjust(accountId: string, direction: "add" | "remove") {
    const amount = Math.max(1, Math.floor(Number(points) || 1));
    const delta = direction === "add" ? amount : -amount;
    setBusy(true);
    const res = await fetch("/api/admin/loyalty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        delta,
        note: "Manual adjustment",
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsgOk(false);
      setMsg(data?.error?.message || "Adjust failed");
      return;
    }
    setMsgOk(true);
    setMsg(
      direction === "add"
        ? `Added ${amount} pts → balance ${data.account.availablePoints}`
        : `Removed ${amount} pts → balance ${data.account.availablePoints}`
    );
    setAdjustId(null);
    load();
  }

  function openAdjust(id: string) {
    setAdjustId(id);
    setPoints(10);
    setMsg("");
  }

  const filtered = useMemo(
    () =>
      accounts.filter((a) =>
        matchesQuery(q, a.phone, a.customer.name, a.availablePoints)
      ),
    [accounts, q]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy">
          Loyalty points
        </h1>
        <p className="mt-1 text-sm text-muted">
          Enter points count, then Add or Remove
        </p>
      </div>

      <AdminSearchBar
        value={q}
        onChange={setQ}
        placeholder="Search phone / customer name…"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Earning rate",
            value: `₹100 = ${rules.pointsPerHundred} pt`,
          },
          { label: "Redemption", value: "100 pts = ₹100" },
          { label: "Min redeem", value: `${rules.minRedemptionPoints} pts` },
          {
            label: "Max discount",
            value: `${rules.maxDiscountPercent}% of bill`,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {item.label}
            </p>
            <p className="mt-2 text-lg font-bold text-navy">{item.value}</p>
          </div>
        ))}
      </div>

      {msg && (
        <p
          className={`rounded-xl px-3 py-2 text-sm ${
            msgOk ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
          }`}
        >
          {msg}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Available</th>
                <th className="px-4 py-3 font-semibold">Earned</th>
                <th className="px-4 py-3 font-semibold">Redeemed</th>
                <th className="px-4 py-3 font-semibold">Last txn</th>
                <th className="px-4 py-3 font-semibold">Adjust</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    {accounts.length === 0
                      ? "No loyalty accounts yet"
                      : "No accounts match your search"}
                  </td>
                </tr>
              )}
              {filtered.map((a) => (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 font-semibold text-navy">
                    {a.customer.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">{a.phone}</td>
                  <td className="px-4 py-3 font-bold text-success">
                    {a.availablePoints}
                  </td>
                  <td className="px-4 py-3">{a.earnedPoints}</td>
                  <td className="px-4 py-3">{a.redeemedPoints}</td>
                  <td className="px-4 py-3 text-muted">
                    {a.transactions[0]
                      ? new Date(
                          a.transactions[0].createdAt
                        ).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {adjustId === a.id ? (
                      <div className="min-w-[260px] space-y-2 rounded-xl border border-border bg-surface-muted/50 p-3">
                        <label className="block text-xs font-semibold text-muted">
                          Points
                          <div className="mt-1 inline-flex w-full items-center overflow-hidden rounded-xl border border-border bg-surface">
                            <button
                              type="button"
                              aria-label="Decrease points input"
                              disabled={busy || points <= 1}
                              onClick={() =>
                                setPoints((n) => Math.max(1, n - 1))
                              }
                              className="flex h-10 w-10 items-center justify-center font-bold text-navy hover:bg-surface-muted disabled:opacity-40"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={100000}
                              value={points}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                setPoints(
                                  Number.isFinite(n) && n > 0
                                    ? Math.floor(n)
                                    : 1
                                );
                              }}
                              className="h-10 min-w-0 flex-1 border-x border-border bg-surface text-center text-sm font-bold tabular-nums text-navy outline-none"
                            />
                            <button
                              type="button"
                              aria-label="Increase points input"
                              disabled={busy}
                              onClick={() =>
                                setPoints((n) => Math.min(100000, n + 1))
                              }
                              className="flex h-10 w-10 items-center justify-center font-bold text-navy hover:bg-surface-muted disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                        </label>
                        <p className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted">
                          Note:{" "}
                          <span className="font-semibold text-navy">
                            Manual adjustment
                          </span>
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => adjust(a.id, "add")}
                            className="rounded-full bg-success/15 px-3 py-1.5 text-xs font-bold text-success disabled:opacity-50"
                          >
                            Add {points}
                          </button>
                          <button
                            type="button"
                            disabled={busy || a.availablePoints < 1}
                            onClick={() => adjust(a.id, "remove")}
                            className="rounded-full bg-danger/10 px-3 py-1.5 text-xs font-bold text-danger disabled:opacity-50"
                          >
                            Remove {points}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setAdjustId(null)}
                            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openAdjust(a.id)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-amber hover:bg-amber/10"
                      >
                        Adjust
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
