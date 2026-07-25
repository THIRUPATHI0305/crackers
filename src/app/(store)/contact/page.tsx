import { getShopSettings } from "@/lib/shop-settings";
import { ContactForm } from "./contact-form";

export default async function ContactPage() {
  const shop = await getShopSettings();

  return (
    <div className="bg-atmosphere min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber">
            Get in touch
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl font-semibold text-navy">
            Contact & shop details
          </h1>
          <p className="mt-3 text-muted">
            Visit our showroom or message us on WhatsApp for pack
            recommendations.
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            {[
              { label: "Shop name", value: shop.name },
              { label: "Address", value: shop.address },
              { label: "Phone", value: shop.phone },
              { label: "WhatsApp", value: shop.whatsapp },
              { label: "Email", value: shop.email },
              { label: "Business hours", value: shop.hours },
            ].map((row) => (
              <div
                key={row.label}
                className="rounded-2xl border border-border bg-surface px-5 py-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {row.label}
                </p>
                <p className="mt-1 font-semibold text-navy">{row.value}</p>
              </div>
            ))}
            <div className="flex flex-wrap gap-3 pt-2">
              {shop.mapsUrl && (
                <a
                  href={shop.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Get directions
                </a>
              )}
              {shop.whatsapp.replace(/\D/g, "") ? (
                <a
                  href={`https://wa.me/${
                    shop.whatsapp.replace(/\D/g, "").length === 10
                      ? `91${shop.whatsapp.replace(/\D/g, "")}`
                      : shop.whatsapp.replace(/\D/g, "")
                  }`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white"
                >
                  WhatsApp us
                </a>
              ) : null}
            </div>
          </div>

          <ContactForm />
        </div>
      </div>
    </div>
  );
}
