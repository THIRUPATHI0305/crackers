"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const nav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/enquiries", label: "Enquiries" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/brands", label: "Brands" },
  { href: "/admin/offers", label: "Offers" },
  { href: "/admin/stock", label: "Stock" },
  { href: "/admin/invoices", label: "Invoices" },
  { href: "/admin/loyalty", label: "Loyalty" },
  { href: "/admin/feedback", label: "Feedback" },
  { href: "/admin/contact", label: "Contact" },
  { href: "/admin/reports/daily", label: "Daily sales" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [shopName, setShopName] = useState("Admin");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.shop?.name?.trim()) setShopName(data.shop.name.trim());
      })
      .catch(() => undefined);
  }, []);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-navy text-white">
      <div className="border-b border-white/10 px-5 py-5">
        <Link href="/admin/dashboard" className="block" onClick={onNavigate}>
          <p className="font-[family-name:var(--font-display)] text-xl font-semibold">
            {shopName}
          </p>
          <p className="mt-0.5 text-xs text-white/55">Admin · Cashier console</p>
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`block rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-amber text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <Link
          href="/"
          className="block rounded-xl border border-white/15 px-3 py-2 text-center text-xs font-semibold text-white/80 hover:bg-white/10"
        >
          View storefront
        </Link>
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST" });
            window.location.href = "/admin/login";
          }}
          className="mt-2 block w-full rounded-xl px-3 py-2 text-center text-xs font-semibold text-white/50 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
