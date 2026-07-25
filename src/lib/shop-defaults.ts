export type ShopSettings = {
  name: string;
  tagline: string;
  headerBanner: string;
  address: string;
  phone: string;
  whatsapp: string;
  /** UPI VPA for GPay / PhonePe (e.g. shop@oksbi) */
  upiId: string;
  email: string;
  hours: string;
  mapsUrl: string;
  languages: { en: boolean; ta: boolean; hi: boolean };
};

/** Blank until Admin → Settings is saved to PostgreSQL. */
export const DEFAULT_SHOP: ShopSettings = {
  name: "",
  tagline: "",
  headerBanner: "",
  address: "",
  phone: "",
  whatsapp: "",
  upiId: "",
  email: "",
  hours: "",
  mapsUrl: "",
  languages: { en: true, ta: true, hi: false },
};
