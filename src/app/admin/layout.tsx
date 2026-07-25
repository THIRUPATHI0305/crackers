"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";
  /** POS billing: lock to viewport — columns scroll, page does not */
  const isBilling = pathname === "/admin/billing";
  const [open, setOpen] = useState(false);
  const [userLabel, setUserLabel] = useState("Admin panel");

  useEffect(() => {
    if (isLogin) return;
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user) {
          const name =
            data.user.username || data.user.email?.split("@")[0] || "Staff";
          setUserLabel(
            `${name} · ${data.user.role} · ${new Date().toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}`
          );
        }
      })
      .catch(() => undefined);
  }, [isLogin, pathname]);

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div
      className={`flex bg-background ${
        isBilling ? "h-dvh overflow-hidden" : "min-h-screen"
      }`}
    >
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64">
        <AdminSidebar />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-navy/40"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 shadow-2xl">
            <AdminSidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div
        className={`flex flex-1 flex-col lg:pl-64 ${
          isBilling ? "h-dvh min-h-0 overflow-hidden" : "min-h-screen"
        }`}
      >
        <header className="sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-navy lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-navy">
              Admin panel
            </p>
            <p className="truncate text-xs text-muted">{userLabel}</p>
          </div>
          <span className="hidden rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success sm:inline">
            Live session
          </span>
        </header>
        <div
          className={
            isBilling
              ? "flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4"
              : "flex-1 p-4 sm:p-6 lg:p-8"
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
