import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { StickyEnquiryBar } from "@/components/StickyEnquiryBar";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { EnquiryCartProvider } from "@/lib/enquiry-cart";
import { LocaleProvider } from "@/lib/locale";
import { ShopProvider } from "@/lib/shop-context";
import { getOffers } from "@/lib/catalog";
import { getShopSettings } from "@/lib/shop-settings";

/** Storefront always reads live DB — never static-prerender at build. */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getShopSettings();
  return {
    title: shop.name
      ? `${shop.name} | Festival Crackers`
      : "Festival Crackers",
    description: shop.tagline || "Browse crackers and festival offers.",
  };
}

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [shop, offers] = await Promise.all([getShopSettings(), getOffers()]);

  const headerOffers = offers.map((o) => ({
    id: o.id,
    title: o.title,
    subtitle: o.subtitle || "",
    discountLabel: o.discountLabel || "",
  }));

  return (
    <ShopProvider shop={shop}>
      <LocaleProvider enabledLanguages={shop.languages}>
        <EnquiryCartProvider>
          <div className="flex min-h-full flex-col">
            <Header offers={headerOffers} />
            <main className="flex-1 pb-24 md:pb-0">{children}</main>
            <Footer />
            <WhatsAppFab />
            <StickyEnquiryBar />
          </div>
        </EnquiryCartProvider>
      </LocaleProvider>
    </ShopProvider>
  );
}
