import { z } from "zod";
import {
  emailSchema,
  idSchema,
  moneySchema,
  percentSchema,
  phoneSchema,
  phone10Schema,
  otpCodeSchema,
  pincodeSchema,
  qtySchema,
  safeText,
  slugSchema,
  youtubeUrlSchema,
  extractYoutubeId,
} from "./primitives";

export {
  emailSchema,
  idSchema,
  moneySchema,
  percentSchema,
  phoneSchema,
  phone10Schema,
  otpCodeSchema,
  pincodeSchema,
  qtySchema,
  safeText,
  slugSchema,
  youtubeUrlSchema,
  extractYoutubeId,
} from "./primitives";

export const loginSchema = z.object({
  user: z.union([emailSchema, z.string().trim().min(3).max(40)]),
  password: z.string().min(8).max(128),
  rememberMe: z.boolean().optional(),
});

export const enquirySchema = z.object({
  name: safeText(30).pipe(z.string().min(2, "Name is required")),
  phone: phoneSchema,
  email: emailSchema,
  whatsapp: phoneSchema,
  city: safeText(80).pipe(z.string().min(2, "City is required")),
  pincode: pincodeSchema,
  language: z.enum(["en", "ta"]).default("en"),
  preferredContact: z.enum(["WHATSAPP", "PHONE", "EITHER"]).default("WHATSAPP"),
  note: z.union([safeText(500), z.literal("")]).optional(),
  area: safeText(80).pipe(z.string().min(2, "Select an area")),
  address: z.union([safeText(200), z.literal("")]).optional(),
  items: z
    .array(
      z.object({
        productId: idSchema,
        /** Used to recover after catalog reseed when product IDs change */
        slug: slugSchema.optional(),
        quantity: qtySchema,
      })
    )
    .min(1, "Cart is empty")
    .max(50),
  clientRequestId: z.string().uuid().optional(),
  /** Redeem loyalty points online (₹1 ≈ 1 pt). Server clamps to balance + caps. */
  loyaltyRedeem: z.number().int().min(0).max(100000).optional().default(0),
  /** Required — enquiry is not stored until OTP verifies */
  otpChallengeId: idSchema,
  otp: otpCodeSchema,
});

/** Client-side draft before OTP (no otp fields). */
export const enquiryDraftSchema = enquirySchema.omit({
  otpChallengeId: true,
  otp: true,
});

export const otpSendSchema = z.object({
  phone: phoneSchema,
  email: emailSchema,
  purpose: z.enum(["ENQUIRY", "LOYALTY", "TRACK", "FEEDBACK", "CONTACT"]),
});

export const otpVerifySchema = z.object({
  challengeId: idSchema,
  phone: phoneSchema,
  email: emailSchema,
  otp: otpCodeSchema,
  purpose: z.enum(["ENQUIRY", "LOYALTY", "TRACK", "FEEDBACK", "CONTACT"]),
});

export const contactSchema = z.object({
  name: safeText(30).pipe(z.string().min(2)),
  phone: phoneSchema,
  email: emailSchema,
  message: safeText(1000).pipe(z.string().min(5)),
  otpChallengeId: idSchema,
  otp: otpCodeSchema,
});

/** Client draft before OTP (no otp fields). */
export const contactDraftSchema = contactSchema.omit({
  otpChallengeId: true,
  otp: true,
});

export const trackOrderSchema = z.object({
  orderNumber: z.string().trim().regex(/^ORD-\d{4}-\d{4,}$/),
  phone: phoneSchema,
});

export const loyaltyCheckSchema = z
  .object({
    phone: phoneSchema,
    email: emailSchema.optional(),
    invoiceNumber: z.string().regex(/^INV-\d{4}-\d{4,}$/).optional(),
    otpChallengeId: idSchema.optional(),
    otp: otpCodeSchema.optional(),
  })
  .refine((d) => d.invoiceNumber || (d.otpChallengeId && d.otp && d.email), {
    message: "Invoice number or verified email OTP required",
  });

export const feedbackSchema = z.object({
  orderNumber: z.string().regex(/^ORD-\d{4}-\d{4,}$/),
  phone: phoneSchema,
  rating: z.number().int().min(1).max(5),
  productQuality: z.number().int().min(1).max(5),
  packingQuality: z.number().int().min(1).max(5),
  staffService: z.number().int().min(1).max(5),
  deliveryExperience: z.number().int().min(1).max(5),
  comment: safeText(1000).optional(),
  allowPublicDisplay: z.boolean().default(false),
});

export const billingSchema = z.object({
  customerName: safeText(80).optional(),
  customerPhone: phoneSchema.optional(),
  paymentMethod: z.enum(["CASH", "UPI", "CARD"]),
  /** @deprecated Manual bill discount removed — server auto-applies offers */
  discountType: z.enum(["NONE", "FIXED", "PERCENT"]).default("NONE"),
  discountValue: z.number().min(0).max(100000).default(0),
  /** Pass available points; server clamps. Use autoLoyalty to apply max. */
  loyaltyRedeem: z.number().int().min(0).max(100000).default(0),
  autoLoyalty: z.boolean().optional().default(true),
  paidAmount: moneySchema.default(0),
  /** When false, no loyalty points are earned for this bill amount */
  awardPoints: z.boolean().optional().default(true),
  /** Link to enquiry — skips earn if PAID already credited pts */
  enquiryId: z.string().min(1).optional(),
  /** When set, update this invoice in place (same INV number + public link) */
  invoiceId: z.string().min(1).optional(),
  items: z
    .array(z.object({ productId: idSchema, quantity: qtySchema }))
    .min(1)
    .max(100),
  idempotencyKey: z.string().uuid(),
});

export const productUpsertSchema = z
  .object({
    nameEn: safeText(120).pipe(z.string().min(2)),
    nameTa: safeText(120).optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,20}$/)
      .optional()
      .or(z.literal("")),
    slug: slugSchema,
    categoryId: idSchema,
    brandId: idSchema.optional().nullable(),
    descriptionEn: safeText(2000).optional(),
    descriptionTa: safeText(2000).optional(),
    safetyNoteEn: safeText(500).optional(),
    safetyNoteTa: safeText(500).optional(),
    originalPrice: moneySchema,
    offerPrice: moneySchema,
    stock: z.number().int().min(0).max(1_000_000),
    minStock: z.number().int().min(0).max(1_000_000).default(10),
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    isBestSeller: z.boolean(),
    isBrandedSale: z.boolean(),
    imageUrl: z.string().max(500).optional(),
    youtubeUrl: youtubeUrlSchema.optional().or(z.literal("")),
    showVideoOnCard: z.boolean().default(true),
    showVideoOnDetails: z.boolean().default(true),
  })
  .refine((d) => d.offerPrice <= d.originalPrice, {
    message: "Offer price cannot exceed original price",
    path: ["offerPrice"],
  });

import { ORDER_TRANSITIONS } from "@/lib/order-transitions";

export { ORDER_TRANSITIONS };

export const orderStatusSchema = z.enum([
  "ENQUIRY_RECEIVED",
  "ORDER_CONFIRMED",
  "PACKING",
  "PACKED",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "LR_SENT",
  "CANCELLED",
]);

export const orderStatusUpdateSchema = z.object({
  status: orderStatusSchema,
  customerMessage: safeText(500).optional(),
  internalNote: safeText(500).optional(),
  eta: z.coerce.date().optional(),
  /** LR copy / proof image URL (required when moving to LR_SENT) */
  lrProofUrl: z.string().max(500).optional().or(z.literal("")),
});

export const stockAdjustSchema = z.object({
  productId: idSchema,
  delta: z
    .number()
    .int()
    .min(-100000)
    .max(100000)
    .refine((n) => n !== 0, "Delta cannot be zero"),
  note: safeText(300).pipe(z.string().min(3)),
});

export const enquiryStatusSchema = z.enum([
  "NEW",
  "CONTACTED",
  "CONFIRMED",
  "PAID",
  "REJECTED",
  "CONVERTED",
  /** Invoice created / WhatsApp bill sent to customer (admin billing) */
  "BILL_SENT",
]);

export const settingsLoyaltySchema = z.object({
  pointsPerHundred: z.number().int().min(0).max(100),
  minRedemptionPoints: z.number().int().min(0).max(100000),
  maxDiscountPercent: percentSchema,
  maxLoyaltyDiscountAmount: moneySchema,
  expiryMonths: z.number().int().min(1).max(60),
  enabled: z.boolean(),
});

export const shopSettingsSchema = z.object({
  name: safeText(80).pipe(z.string().min(2)),
  tagline: safeText(200).optional().or(z.literal("")),
  headerBanner: safeText(200).optional().or(z.literal("")),
  address: safeText(300).pipe(z.string().min(5)),
  phone: safeText(40).pipe(z.string().min(8)),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, "WhatsApp must be digits only"),
  /** UPI VPA e.g. merchant@oksbi — used for GPay / PhonePe links */
  upiId: z
    .string()
    .trim()
    .max(80)
    .regex(/^$|^[\w.\-]{2,60}@[\w.\-]{2,40}$/i, "Enter a valid UPI ID")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email().max(120).or(z.literal("")),
  hours: safeText(120).optional().or(z.literal("")),
  mapsUrl: z.string().trim().url().max(500).or(z.literal("")),
  languages: z.object({
    en: z.boolean(),
    ta: z.boolean(),
    hi: z.boolean(),
  }),
});

export const otpSettingsSchema = z.object({
  /** Company email OTP is sent FROM (defaults to shop email) */
  emailFrom: z.string().trim().max(120).email().or(z.literal("")).optional(),
  smtpHost: z.string().trim().max(120).or(z.literal("")).optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().trim().max(120).or(z.literal("")).optional(),
  smtpPass: z.string().max(200).optional(),
  clearSmtpPass: z.boolean().optional(),
  resendApiKey: z.string().max(200).optional(),
  clearResendApiKey: z.boolean().optional(),
  /** AuthKey portal auth key — https://authkey.io/2fa-api-docs */
  authkeyAuthKey: z.string().max(200).optional(),
  /** AuthKey SMS template SID (body must include {#2fa#}) */
  authkeySid: z.string().max(50).optional(),
  clearAuthkey: z.boolean().optional(),
  /** New Fast2SMS key; empty string = keep existing key */
  fast2smsApiKey: z.string().max(200).optional(),
  /** Set true to remove stored key */
  clearFast2smsApiKey: z.boolean().optional(),
});

export const settingsSaveSchema = z.object({
  shop: shopSettingsSchema,
  loyalty: settingsLoyaltySchema,
  otp: otpSettingsSchema.optional(),
});

export const categoryUpsertSchema = z.object({
  id: idSchema.optional(),
  nameEn: safeText(80).pipe(z.string().min(2)),
  nameTa: safeText(80).optional(),
  slug: slugSchema,
  description: safeText(300).optional(),
  imageUrl: z.string().max(500).optional().or(z.literal("")),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export const brandUpsertSchema = z.object({
  id: idSchema.optional(),
  nameEn: safeText(80).pipe(z.string().min(2)),
  nameTa: safeText(80).optional(),
  slug: slugSchema,
  taglineEn: safeText(200).optional(),
  taglineTa: safeText(200).optional(),
  saleLabel: safeText(80).optional(),
  accent: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a hex color like #0f2744")
    .optional()
    .or(z.literal("")),
  imageUrl: z.string().max(500).optional().or(z.literal("")),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export const offerUpsertSchema = z
  .object({
    id: idSchema.optional(),
    title: safeText(120).pipe(z.string().min(2)),
    subtitle: safeText(200).optional(),
    type: z.enum(["FESTIVAL", "COMBO", "PERCENT", "CATEGORY", "FLAT"]),
    discountLabel: safeText(40).optional(),
    percentOff: z.number().min(0).max(100).optional().nullable(),
    fixedOff: moneySchema.optional().nullable(),
    /** Required when type is CATEGORY */
    categoryIds: z.array(idSchema).max(50).optional().default([]),
    /** Required when type is COMBO — products in the combo */
    productIds: z.array(idSchema).max(100).optional().default([]),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.endAt >= d.startAt, {
    message: "End date must be on or after start date",
    path: ["endAt"],
  })
  .refine(
    (d) => d.type !== "CATEGORY" || (d.categoryIds && d.categoryIds.length > 0),
    {
      message: "Select at least one category for CATEGORY offers",
      path: ["categoryIds"],
    }
  )
  .refine(
    (d) => d.type !== "COMBO" || (d.productIds && d.productIds.length >= 2),
    {
      message: "Select at least 2 products for a COMBO offer",
      path: ["productIds"],
    }
  );

export const loyaltyAdjustSchema = z.object({
  accountId: idSchema,
  delta: z
    .number()
    .int()
    .min(-100000)
    .max(100000)
    .refine((n) => n !== 0, "Delta cannot be zero"),
  note: safeText(300).pipe(z.string().min(3)),
});
