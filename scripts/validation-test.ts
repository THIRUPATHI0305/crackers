/**
 * Unit tests for Zod validation schemas (no server required).
 * Run: npx tsx scripts/validation-test.ts
 */
import {
  billingSchema,
  enquirySchema,
  loginSchema,
  ORDER_TRANSITIONS,
  orderStatusUpdateSchema,
  phoneSchema,
  trackOrderSchema,
  youtubeUrlSchema,
} from "../src/lib/validation";

/** Sample 10-digit Indian mobile for schema fixtures (not a real contact). */
const SAMPLE_PHONE_10 = "9000012345";
const SAMPLE_PHONE_E164 = `91${SAMPLE_PHONE_10}`;

let passed = 0;
let failed = 0;

function assert(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// Phone
assert("phone accepts 10-digit", phoneSchema.safeParse(SAMPLE_PHONE_10).success);
assert(
  "phone accepts 91 prefix",
  phoneSchema.safeParse(SAMPLE_PHONE_E164).success
);
assert("phone rejects landline-like", !phoneSchema.safeParse("12345").success);
assert(
  "phone normalizes to 91",
  phoneSchema.parse(SAMPLE_PHONE_10) === SAMPLE_PHONE_E164
);

// Login
assert("login ok", loginSchema.safeParse({ user: "a@b.com", password: "12345678" }).success);
assert(
  "login short password fails",
  !loginSchema.safeParse({ user: "a@b.com", password: "123" }).success
);

const enquiryBase = {
  name: "Priya S",
  phone: SAMPLE_PHONE_10,
  email: "priya@example.com",
  whatsapp: SAMPLE_PHONE_10,
  city: "Madurai",
  area: "Keerathurai",
  pincode: "625001",
  items: [{ productId: "abc", quantity: 1 }],
  otpChallengeId: "challenge1",
  otp: "123456",
};

// Enquiry
assert(
  "enquiry requires items",
  !enquirySchema.safeParse({
    ...enquiryBase,
    items: [],
  }).success
);
assert(
  "enquiry requires OTP",
  !enquirySchema.safeParse({
    name: "Priya S",
    phone: SAMPLE_PHONE_10,
    email: "priya@example.com",
    whatsapp: SAMPLE_PHONE_10,
    city: "Madurai",
    area: "Keerathurai",
    pincode: "625001",
    items: [{ productId: "abc", quantity: 1 }],
  }).success
);
assert("enquiry ok", enquirySchema.safeParse(enquiryBase).success);
assert(
  "enquiry requires email",
  !enquirySchema.safeParse({
    ...enquiryBase,
    email: undefined,
  }).success
);

// Track
assert(
  "track format",
  trackOrderSchema.safeParse({
    orderNumber: "ORD-2026-0001",
    phone: SAMPLE_PHONE_10,
  }).success
);
assert(
  "track bad number",
  !trackOrderSchema.safeParse({
    orderNumber: "ORDER1",
    phone: SAMPLE_PHONE_10,
  }).success
);

// Billing
assert(
  "billing requires items",
  !billingSchema.safeParse({
    paymentMethod: "UPI",
    paidAmount: 100,
    idempotencyKey: "00000000-0000-4000-8000-000000000001",
    items: [],
  }).success
);
assert(
  "billing ok",
  billingSchema.safeParse({
    paymentMethod: "CASH",
    paidAmount: 100,
    idempotencyKey: "00000000-0000-4000-8000-000000000002",
    items: [{ productId: "p1", quantity: 1 }],
  }).success
);

// YouTube
assert(
  "youtube watch ok",
  youtubeUrlSchema.safeParse("https://www.youtube.com/watch?v=abc123xyz").success
);
assert(
  "youtube rejects other domain",
  !youtubeUrlSchema.safeParse("https://evil.com/watch?v=abc").success
);

// Transitions
assert(
  "PACKING → PACKED allowed",
  ORDER_TRANSITIONS.PACKING.includes("PACKED")
);
assert(
  "PACKING → DELIVERED not allowed",
  !ORDER_TRANSITIONS.PACKING.includes("DELIVERED")
);
assert(
  "order status schema accepts PACKED",
  orderStatusUpdateSchema.safeParse({ status: "PACKED" }).success
);

console.log(`\n—— Validation: ${passed} passed, ${failed} failed ——\n`);
if (failed) process.exit(1);
