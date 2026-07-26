export type UiCopyKey =
  | "nav.home"
  | "nav.products"
  | "nav.brands"
  | "nav.offers"
  | "nav.track"
  | "nav.loyalty"
  | "nav.contact"
  | "nav.cart"
  | "nav.viewCart"
  | "nav.search"
  | "nav.searchPlaceholder"
  | "nav.openMenu"
  | "nav.call"
  | "footer.shop"
  | "footer.allProducts"
  | "footer.offers"
  | "footer.loyalty"
  | "footer.track"
  | "footer.visit"
  | "footer.ready"
  | "footer.enquire"
  | "footer.blurb"
  | "home.shopProducts"
  | "home.browseBrands"
  | "home.heroSupport"
  | "home.limited"
  | "home.currentOffers"
  | "home.allOffers"
  | "home.shopByCategory"
  | "home.featured"
  | "home.viewAll"
  | "home.products"
  | "common.add"
  | "common.view"
  | "common.outOfStock"
  | "common.inStock"
  | "common.left"
  | "common.available"
  | "common.safety"
  | "common.related";

type Table = Record<UiCopyKey, string>;

export const uiCopy: { en: Table; ta: Table } = {
  en: {
    "nav.home": "Home",
    "nav.products": "Products",
    "nav.brands": "Brands",
    "nav.offers": "Offers",
    "nav.track": "Track Order",
    "nav.loyalty": "Loyalty",
    "nav.contact": "Contact",
    "nav.cart": "Cart",
    "nav.viewCart": "View cart",
    "nav.search": "Search products",
    "nav.searchPlaceholder": "Search sparklers, gift boxes, rockets…",
    "nav.openMenu": "Open menu",
    "nav.call": "Call",
    "footer.shop": "Shop",
    "footer.allProducts": "All products",
    "footer.offers": "Festival offers",
    "footer.loyalty": "Loyalty points",
    "footer.track": "Track order",
    "footer.visit": "Visit us",
    "footer.ready": "Ready to order?",
    "footer.enquire": "Start enquiry",
    "footer.blurb":
      "Enquire online, confirm on WhatsApp, track delivery with confidence.",
    "home.shopProducts": "Shop products",
    "home.browseBrands": "Browse brands",
    "home.heroSupport":
      "Browse offers, add to cart, confirm on WhatsApp — no account, no online payment.",
    "home.limited": "Limited-time",
    "home.currentOffers": "Current festival offers",
    "home.allOffers": "All offers",
    "home.shopByCategory": "Shop by category",
    "home.featured": "Featured crackers",
    "home.viewAll": "View all",
    "home.products": "products",
    "common.add": "Add",
    "common.view": "View",
    "common.outOfStock": "Out of stock",
    "common.inStock": "In stock",
    "common.left": "left",
    "common.available": "available",
    "common.safety": "Safety",
    "common.related": "Related products",
  },
  ta: {
    "nav.home": "முகப்பு",
    "nav.products": "பொருட்கள்",
    "nav.brands": "பிராண்டுகள்",
    "nav.offers": "சலுகைகள்",
    "nav.track": "ஆர்டர் கண்காணிப்பு",
    "nav.loyalty": "விசுவாசப் புள்ளிகள்",
    "nav.contact": "தொடர்பு",
    "nav.cart": "வண்டி",
    "nav.viewCart": "வண்டியைப் பார்",
    "nav.search": "பொருட்களைத் தேடு",
    "nav.searchPlaceholder": "ஸ்பார்க்லர், கிஃப்ட் பாக்ஸ், ராக்கெட்…",
    "nav.openMenu": "மெனு திற",
    "nav.call": "அழை",
    "footer.shop": "கடை",
    "footer.allProducts": "அனைத்து பொருட்கள்",
    "footer.offers": "திருவிழா சலுகைகள்",
    "footer.loyalty": "விசுவாசப் புள்ளிகள்",
    "footer.track": "ஆர்டர் கண்காணிப்பு",
    "footer.visit": "எங்களை சந்திக்க",
    "footer.ready": "ஆர்டர் செய்ய தயாரா?",
    "footer.enquire": "வினவல் தொடங்கு",
    "footer.blurb":
      "ஆன்லைனில் வினவல், WhatsApp-ல் உறுதி, நம்பிக்கையுடன் டெலிவரி கண்காணிப்பு.",
    "home.shopProducts": "பொருட்களை வாங்கு",
    "home.browseBrands": "பிராண்டுகளைப் பார்",
    "home.heroSupport":
      "சலுகைகளைப் பாருங்கள், வண்டியில் சேருங்கள், WhatsApp-ல் உறுதி செய்யுங்கள் — கணக்கு தேவையில்லை.",
    "home.limited": "குறுகிய காலம்",
    "home.currentOffers": "தற்போதைய திருவிழா சலுகைகள்",
    "home.allOffers": "அனைத்து சலுகைகள்",
    "home.shopByCategory": "வகை வாரியாக வாங்கு",
    "home.featured": "சிறப்பு பட்டாசுகள்",
    "home.viewAll": "அனைத்தையும் பார்",
    "home.products": "பொருட்கள்",
    "common.add": "சேர்",
    "common.view": "பார்",
    "common.outOfStock": "ஸ்டாக் இல்லை",
    "common.inStock": "ஸ்டாக் உள்ளது",
    "common.left": "மீதம்",
    "common.available": "கிடைக்கும்",
    "common.safety": "பாதுகாப்பு",
    "common.related": "தொடர்புடைய பொருட்கள்",
  },
};
