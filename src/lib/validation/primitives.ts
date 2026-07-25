import { z } from "zod";

/** Digits only; strip +91 / spaces; require exactly 10 Indian mobile digits. */
export function normalizePhoneDigits(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("91") && d.length === 12) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return d;
}

/** 10-digit display/input validation (no country code in the field). */
export const phone10Schema = z
  .string()
  .transform(normalizePhoneDigits)
  .refine((s) => /^[6-9]\d{9}$/.test(s), "Enter a valid 10-digit mobile number");

/** Stored form: 91 + 10 digits. */
export const phoneSchema = phone10Schema.transform((s) => `91${s}`);

export const emailSchema = z.string().trim().email().max(120).toLowerCase();

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug")
  .min(2)
  .max(80);

export const moneySchema = z.number().finite().min(0).max(9_999_999.99);

export const percentSchema = z.number().finite().min(0).max(100);

export const qtySchema = z.number().int().min(1).max(999);

export const idSchema = z.string().min(1).max(40);

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit OTP");

export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter a valid 6-digit pincode");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
});

export const youtubeUrlSchema = z
  .string()
  .url()
  .max(300)
  .refine(
    (u) =>
      /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/.test(
        u
      ),
    "Only YouTube watch / short / youtu.be URLs allowed"
  );

export function safeText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((s) =>
      s
        .replace(/<[^>]*>/g, "")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    );
}

export function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|shorts\/)([A-Za-z0-9_-]{6,})/);
  return m?.[1] ?? null;
}
