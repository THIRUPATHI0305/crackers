"use client";

import { useShop } from "@/lib/shop-context";
import { normalizeWaDigits } from "@/lib/whatsapp";

export function WhatsAppFab() {
  const shop = useShop();
  const wa = normalizeWaDigits(shop.whatsapp);
  if (!wa) return null;

  return (
    <a
      href={`https://wa.me/${wa}?text=${encodeURIComponent(
        `Hi ${shop.name || "there"}, I would like to enquire about festival crackers.`
      )}`}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-2xl text-white shadow-[0_8px_24px_rgba(37,211,102,0.45)] transition hover:scale-105 md:bottom-6"
      aria-label="Chat on WhatsApp"
    >
      ✆
    </a>
  );
}
