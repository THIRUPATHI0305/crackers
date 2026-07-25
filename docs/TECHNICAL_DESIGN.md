# SparkNova Crackers — Technical Design Document

**Version:** 1.0  
**Date:** 20 Jul 2026  
**Status:** Design complete · UI prototype live · Backend not yet implemented  
**Scope:** Customer storefront, admin panel, billing, loyalty, tracking, WhatsApp prep, brands

---

## 1. Document purpose

This document defines the **enterprise-ready technical design** for connecting the current UI to a secure backend: API contracts, database schema, validation, encryption, security controls, and remaining gaps.

Use it as the single source of truth for implementation.

---

## 2. Current vs target state

| Layer | Current (UI MVP) | Target (Production) |
|--------|------------------|---------------------|
| Frontend | Next.js App Router + Tailwind + Framer Motion | Same + next-intl + real API clients |
| Data | Mock TS files (`src/lib/data.ts`, `admin-data.ts`) | Prisma + PostgreSQL (Supabase) |
| Auth | Demo login (any credentials) | Session cookies + RBAC (Admin / Cashier) |
| APIs | None | Next.js Route Handlers + Server Actions |
| Files | Local `/public/images` | Supabase Storage (private buckets + signed URLs) |
| Security | UI-only | Hashing, TLS, rate limits, validation, audit logs |
| Payments | Not in scope | Record method only (Cash / UPI / Card) — no gateway |

---

## 3. System architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  Clients                                                     │
│  • Customer web (Next.js)  • Admin/Cashier panel            │
│  • Android WebView (Capacitor)  • WhatsApp (deep links)     │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS (TLS 1.2+)
┌───────────────────────────▼─────────────────────────────────┐
│  Next.js on Vercel                                           │
│  • App Router pages (UI)                                     │
│  • Route Handlers  /api/*                                    │
│  • Server Actions (mutations)                                │
│  • Middleware (auth, locale, rate-limit headers)             │
└───────┬─────────────────────┬────────────────────┬──────────┘
        │                     │                    │
        ▼                     ▼                    ▼
┌───────────────┐   ┌─────────────────┐   ┌──────────────────┐
│ PostgreSQL    │   │ Supabase Storage│   │ Secrets / Env    │
│ (Supabase)    │   │ product images  │   │ DATABASE_URL     │
│ Prisma ORM    │   │ proof images    │   │ SESSION_SECRET   │
│               │   │ invoice PDFs    │   │ STORAGE keys     │
└───────────────┘   └─────────────────┘   └──────────────────┘
```

### Design principles

1. **No customer accounts** — identity = mobile number + order/invoice/enquiry numbers.  
2. **Enquiry ≠ payment** — website never collects card/UPI credentials.  
3. **Server-side authority** — prices, stock, loyalty, discounts computed on server only.  
4. **Least privilege** — Cashier cannot delete catalogue or change system settings.  
5. **Defence in depth** — TLS + hashed passwords + HTTP-only cookies + Zod validation + RBAC + rate limits + audit trail.

---

## 4. Technology stack (locked)

| Concern | Choice | Why |
|---------|--------|-----|
| App framework | Next.js 16 (App Router) + TypeScript | Already used in UI; SSR + APIs in one deploy |
| Styling | Tailwind CSS | Matches current design system |
| ORM | Prisma | Typed schema, migrations, safe queries |
| Database | PostgreSQL (Supabase hosted) | Relational integrity for billing/stock |
| Auth session | `iron-session` or NextAuth credentials / custom sealed cookie | HTTP-only, encrypted cookie payload |
| Password hashing | Argon2id (preferred) or bcrypt (cost ≥ 12) | Industry standard; never store plaintext |
| Validation | Zod (shared schemas for API + Server Actions) | Single source of input rules |
| File storage | Supabase Storage | Private buckets + short-lived signed URLs |
| i18n | next-intl (`en`, `ta`) | Requirement languages |
| Hosting | Vercel + Supabase | Matches MVP requirements |
| Rate limiting | Upstash Redis / Vercel KV (or edge middleware counters) | Login + public tracking abuse |

---

## 5. Environment & secrets

### Required environment variables

```bash
# Database
DATABASE_URL=postgresql://...          # server-only
DIRECT_URL=postgresql://...            # Prisma migrations

# Auth
SESSION_SECRET=                         # ≥ 32 random bytes
SESSION_COOKIE_NAME=sn_admin_session
PASSWORD_PEPPER=                        # optional server-side pepper

# Storage
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=              # server-only — never NEXT_PUBLIC_
SUPABASE_ANON_KEY=                      # only if needed for public signed reads
STORAGE_BUCKET_PRODUCTS=products
STORAGE_BUCKET_PROOFS=order-proofs
STORAGE_BUCKET_INVOICES=invoices

# App
NEXT_PUBLIC_APP_URL=https://yourdomain.com
WHATSAPP_BUSINESS_NUMBER=9198XXXXXXXX
INVOICE_LINK_TOKEN_SECRET=              # HMAC for public invoice URLs (optional)

# Rate limit
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### Rules

- Never prefix secrets with `NEXT_PUBLIC_`.
- Rotate `SESSION_SECRET` and storage keys on compromise.
- Separate staging and production databases.
- Use Vercel encrypted env + Supabase RLS where applicable.

---

## 6. Database design

### 6.1 Entity relationship (logical)

```text
brands ──< products >── product_images
   │            │
   │            ├── product_videos
   │            └── offer_products >── offers
   │
customers ──< enquiries >── enquiry_items >── products
   │              │
   │              └──> orders >── order_items
   │                      │
   │                      ├── order_status_history
   │                      ├── order_proof_images
   │                      └── feedback
   │
   ├── loyalty_accounts ──< loyalty_transactions
   └── invoices >── invoice_items >── products
              │
              └── stock_transactions (also from billing + admin adjust)

admin_users (role: ADMIN | CASHIER)
settings
translations
audit_logs
```

### 6.2 Prisma models (canonical)

```prisma
enum AdminRole { ADMIN CASHIER }
enum EnquiryStatus { NEW CONTACTED CONFIRMED REJECTED CONVERTED }
enum OrderStatus {
  ENQUIRY_RECEIVED ORDER_CONFIRMED PACKING PACKED
  READY_FOR_PICKUP SHIPPED OUT_FOR_DELIVERY DELIVERED CANCELLED
}
enum PaymentMethod { CASH UPI CARD }
enum LoyaltyTxnType { EARNED REDEEMED EXPIRED CANCELLED MANUAL_ADJUST }
enum OfferType {
  PERCENT FIXED COMBO BUY_MORE FESTIVAL CATEGORY_WIDE
}

model AdminUser {
  id           String    @id @default(cuid())
  email        String    @unique
  username     String?   @unique
  passwordHash String
  role         AdminRole
  isActive     Boolean   @default(true)
  failedLogins Int       @default(0)
  lockedUntil  DateTime?
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  auditLogs    AuditLog[]
  invoices     Invoice[] @relation("CashierInvoices")
}

model Brand {
  id        String    @id @default(cuid())
  nameEn    String
  nameTa    String?
  slug      String    @unique
  taglineEn String?
  taglineTa String?
  saleLabel String?
  accent    String?
  imageUrl  String?
  isActive  Boolean   @default(true)
  sortOrder Int       @default(0)
  products  Product[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Category {
  id          String    @id @default(cuid())
  nameEn      String
  nameTa      String?
  slug        String    @unique
  description String?
  imageUrl    String?
  productCount Int      @default(0)
  isActive    Boolean   @default(true)
  sortOrder   Int       @default(0)
  products    Product[]
  offers      Offer[]
}

model Product {
  id            String   @id @default(cuid())
  code          String   @unique
  slug          String   @unique
  nameEn        String
  nameTa        String?
  descriptionEn String?
  descriptionTa String?
  safetyNoteEn  String?
  safetyNoteTa  String?
  categoryId    String
  brandId       String?
  originalPrice Decimal  @db.Decimal(12, 2)
  offerPrice    Decimal  @db.Decimal(12, 2)
  stock         Int      @default(0)
  minStock      Int      @default(10)
  isActive      Boolean  @default(true)
  isFeatured    Boolean  @default(false)
  isBestSeller  Boolean  @default(false)
  isBrandedSale Boolean  @default(false)
  category      Category @relation(fields: [categoryId], references: [id])
  brand         Brand?   @relation(fields: [brandId], references: [id])
  images        ProductImage[]
  video         ProductVideo?
  // ... relation fields for enquiry/order/invoice items
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([categoryId, isActive])
  @@index([brandId, isBrandedSale])
  @@index([code])
}

model ProductImage {
  id        String  @id @default(cuid())
  productId String
  url       String
  sortOrder Int     @default(0)
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
}

model ProductVideo {
  id                String  @id @default(cuid())
  productId         String  @unique
  youtubeUrl        String
  youtubeVideoId    String
  videoTitle        String?
  thumbnailUrl      String?
  showOnCard        Boolean @default(true)
  showOnDetails     Boolean @default(true)
  product           Product @relation(fields: [productId], references: [id], onDelete: Cascade)
}

model Customer {
  id        String   @id @default(cuid())
  name      String?
  phone     String   @unique   // E.164 normalized, e.g. 91XXXXXXXXXX
  whatsapp  String?
  city      String?
  area      String?
  pincode   String?
  language  String   @default("en")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  enquiries Enquiry[]
  orders    Order[]
  invoices  Invoice[]
  loyalty   LoyaltyAccount?
}

model Enquiry {
  id          String        @id @default(cuid())
  number      String        @unique  // ENQ-YYYY-####
  customerId  String
  status      EnquiryStatus @default(NEW)
  address     String?
  note        String?
  preferredContact String?
  estimatedAmount Decimal   @db.Decimal(12, 2)
  internalNote String?
  customer    Customer      @relation(fields: [customerId], references: [id])
  items       EnquiryItem[]
  order       Order?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

model Order {
  id              String      @id @default(cuid())
  number          String      @unique  // ORD-YYYY-####
  enquiryId       String?     @unique
  customerId      String
  status          OrderStatus @default(ENQUIRY_RECEIVED)
  amount          Decimal     @db.Decimal(12, 2)
  eta             DateTime?
  customerNote    String?
  internalNote    String?
  deliveredAt     DateTime?
  customerConfirmedAt DateTime?
  customer        Customer    @relation(fields: [customerId], references: [id])
  enquiry         Enquiry?    @relation(fields: [enquiryId], references: [id])
  items           OrderItem[]
  history         OrderStatusHistory[]
  proofs          OrderProofImage[]
  feedback        Feedback?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([number, customerId])
}

model Invoice {
  id            String        @id @default(cuid())
  number        String        @unique  // INV-YYYY-####
  publicToken   String        @unique  // unguessable token for public URL
  customerId    String?
  customerName  String?
  customerPhone String?
  subtotal      Decimal       @db.Decimal(12, 2)
  productDiscount Decimal     @db.Decimal(12, 2) @default(0)
  billDiscount  Decimal       @db.Decimal(12, 2) @default(0)
  loyaltyRedeem Decimal       @db.Decimal(12, 2) @default(0)
  taxAmount     Decimal       @db.Decimal(12, 2) @default(0)
  grandTotal    Decimal       @db.Decimal(12, 2)
  paidAmount    Decimal       @db.Decimal(12, 2)
  balanceAmount Decimal       @db.Decimal(12, 2)
  paymentMethod PaymentMethod
  pointsEarned  Int           @default(0)
  cashierId     String
  cancelledAt   DateTime?
  customer      Customer?     @relation(fields: [customerId], references: [id])
  cashier       AdminUser     @relation("CashierInvoices", fields: [cashierId], references: [id])
  items         InvoiceItem[]
  createdAt     DateTime      @default(now())

  @@index([customerPhone])
  @@index([createdAt])
}

model LoyaltyAccount {
  id              String   @id @default(cuid())
  customerId      String   @unique
  phone           String   @unique
  availablePoints Int      @default(0)
  earnedPoints    Int      @default(0)
  redeemedPoints  Int      @default(0)
  expiresAt       DateTime?
  customer        Customer @relation(fields: [customerId], references: [id])
  transactions    LoyaltyTransaction[]
}

model AuditLog {
  id         String   @id @default(cuid())
  adminId    String?
  action     String
  entityType String
  entityId   String?
  ip         String?
  userAgent  String?
  meta       Json?
  createdAt  DateTime @default(now())
  admin      AdminUser? @relation(fields: [adminId], references: [id])

  @@index([entityType, entityId])
  @@index([createdAt])
}

model Setting {
  key   String @id
  value Json
}
```

*(Remaining join/item tables: `EnquiryItem`, `OrderItem`, `InvoiceItem`, `Offer`, `OfferProduct`, `StockTransaction`, `Feedback`, `Translation` — same fields as MVP requirements §13–15.)*

### 6.3 Integrity rules (DB level)

| Rule | Enforcement |
|------|-------------|
| Stock never negative | Check constraint `stock >= 0` + transactional deduct |
| Invoice number unique | Unique index |
| Phone uniqueness | Unique on `customers.phone`, `loyalty_accounts.phone` |
| Cascade media with product | `onDelete: Cascade` for images/video |
| Soft-delete preference | Prefer `isActive=false` / `cancelledAt` over hard delete for invoices |
| Money precision | `Decimal(12,2)` — never float |

### 6.4 Indexes for performance

- `products(slug)`, `products(code)`, `products(brandId, isBrandedSale)`
- `enquiries(number)`, `orders(number)`, `invoices(number)`, `invoices(publicToken)`
- `orders(status, updatedAt)` for packing queues
- `invoices(createdAt)` for daily sales reports

---

## 7. API design

### 7.1 Conventions

| Rule | Detail |
|------|--------|
| Base | `/api/...` Route Handlers |
| Format | JSON (`Content-Type: application/json`) |
| Errors | `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": {} } }` |
| Auth | Admin cookie session; public endpoints unauthenticated but rate-limited |
| IDs | Prefer business numbers in public APIs (`ORD-…`, `INV-…`); internal `cuid` for admin |
| Versioning | Unversioned for MVP; add `/api/v1` if breaking changes later |

### 7.2 Public APIs

| Method | Path | Purpose | Auth | Rate limit |
|--------|------|---------|------|------------|
| GET | `/api/categories` | Active categories | Public | Soft |
| GET | `/api/brands` | Active brands + sale labels | Public | Soft |
| GET | `/api/brands/:slug` | Brand + products | Public | Soft |
| GET | `/api/products` | List/filter (`category`, `brand`, `q`, `minPrice`, `maxPrice`, `onOffer`, `brandedSale`, `sort`) | Public | Soft |
| GET | `/api/products/:slug` | Product detail | Public | Soft |
| GET | `/api/offers` | Active offers in date window | Public | Soft |
| POST | `/api/enquiries` | Submit enquiry cart | Public | Medium |
| POST | `/api/order-tracking` | Track by order# + phone | Public | **Strict** |
| POST | `/api/loyalty/check` | Points by phone + invoice/OTP | Public | **Strict** |
| GET | `/api/public/invoices/:token` | Public invoice (masked phone) | Token | Soft |
| POST | `/api/feedback` | Post-delivery feedback | Public + order verify | Medium |
| POST | `/api/contact` | Contact form | Public | Medium |

### 7.3 Admin APIs

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| POST | `/api/admin/login` | — | Create session |
| POST | `/api/admin/logout` | Any | Destroy session |
| GET | `/api/admin/me` | Any | Current user + role |
| GET | `/api/admin/dashboard` | ADMIN | Metrics |
| CRUD | `/api/admin/products` | ADMIN | Catalogue (+ YouTube video) |
| CRUD | `/api/admin/categories` | ADMIN | Categories |
| CRUD | `/api/admin/brands` | ADMIN | Brands / branded sales |
| CRUD | `/api/admin/offers` | ADMIN | Offers |
| GET/PUT | `/api/admin/enquiries` | ADMIN | Queue + status |
| POST | `/api/admin/enquiries/:id/convert-order` | ADMIN | Enquiry → order |
| GET/PUT | `/api/admin/orders` | ADMIN | Status + notes |
| POST | `/api/admin/orders/:id/proof` | ADMIN | Proof upload |
| POST | `/api/admin/invoices` | ADMIN, CASHIER | Create bill (transactional) |
| GET | `/api/admin/invoices` | ADMIN, CASHIER | History |
| POST | `/api/admin/stock/adjust` | ADMIN | Manual stock |
| GET | `/api/admin/reports/daily` | ADMIN | Daily sales |
| GET/PUT | `/api/admin/loyalty` | ADMIN | Accounts + rules |
| GET | `/api/admin/feedback` | ADMIN | Reviews |
| GET/PUT | `/api/admin/settings` | ADMIN only | Shop + loyalty config |

### 7.4 Example: create invoice (transaction)

```text
BEGIN
  1. Validate cashier session + payload (Zod)
  2. Lock product rows (SELECT … FOR UPDATE)
  3. Ensure qty ≤ stock for each line
  4. Recompute prices from DB (ignore client prices)
  5. Apply bill discount ≤ settings.maxDiscount
  6. Apply loyalty redeem ≤ available points
  7. Insert invoice + items
  8. Decrement stock + insert stock_transactions
  9. Upsert loyalty account + earn points
  10. Insert audit_log
COMMIT
Return invoice number + publicToken + WhatsApp message template
```

### 7.5 Frontend connection pattern

```text
UI component
   → fetch('/api/...') or server action
      → Zod parse
         → auth / RBAC check
            → Prisma / Storage
               → typed DTO response
```

- Customer pages: prefer **Server Components** fetching via Prisma (or cached GET APIs).
- Mutations (enquiry, billing): **Server Actions** or POST Route Handlers.
- Never trust client-sent `offerPrice`, `grandTotal`, or `pointsEarned`.

---

## 8. Data validation (enterprise catalogue)

> **Audit status (20 Jul 2026)**  
> - **Design doc:** validation rules are specified in this section (complete below).  
> - **Runtime code:** Zod / server validation is **NOT implemented yet** — UI forms only.  
> - Target: every API + Server Action must call a shared schema from `src/lib/validation/*`.

### 8.0 Validation layers (must all pass)

```text
1. Transport     → HTTPS, max body size (e.g. 1MB JSON / 5MB multipart)
2. Schema (Zod)  → type, length, format, enum, required fields
3. Business      → stock, discount caps, loyalty balance, status transitions
4. AuthZ         → role can perform this action
5. Persistence   → DB constraints (unique, check, FK)
6. Output        → mask PII, strip secrets, stable error shape
```

### 8.1 Shared primitives

```ts
import { z } from "zod";

export const phoneSchema = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .refine((s) => /^(91)?[6-9]\d{9}$/.test(s), "Invalid Indian mobile number")
  .transform((s) => (s.length === 10 ? `91${s}` : s)); // store E.164-ish

export const emailSchema = z.string().trim().email().max(120).toLowerCase();

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug")
  .min(2)
  .max(80);

export const moneySchema = z
  .number()
  .finite()
  .multipleOf(0.01)
  .min(0)
  .max(9_999_999.99);

export const percentSchema = z.number().finite().min(0).max(100);

export const qtySchema = z.number().int().min(1).max(999);

export const cuidSchema = z.string().cuid();

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

/** Strip control chars + HTML tags from free text */
export const safeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s.replace(/<[^>]*>/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""));
```

### 8.2 Domain schemas (complete set)

#### Auth

```ts
export const loginSchema = z.object({
  user: z.union([emailSchema, z.string().trim().min(3).max(40)]),
  password: z.string().min(8).max(128),
  rememberMe: z.boolean().optional(),
});

// Admin create/reset (ADMIN only) — password policy
export const passwordPolicySchema = z
  .string()
  .min(10)
  .max(128)
  .regex(/[A-Z]/, "Need uppercase")
  .regex(/[a-z]/, "Need lowercase")
  .regex(/[0-9]/, "Need digit")
  .regex(/[^A-Za-z0-9]/, "Need special character");
```

#### Enquiry / contact

```ts
export const enquirySchema = z.object({
  name: safeText(80).pipe(z.string().min(2)),
  phone: phoneSchema,
  whatsapp: phoneSchema,
  city: safeText(80).pipe(z.string().min(2)),
  area: safeText(80).optional(),
  address: safeText(200).optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  language: z.enum(["en", "ta"]).default("en"),
  preferredContact: z.enum(["WHATSAPP", "PHONE", "EITHER"]).default("WHATSAPP"),
  note: safeText(500).optional(),
  items: z
    .array(z.object({ productId: cuidSchema, quantity: qtySchema }))
    .min(1)
    .max(50),
  // idempotency for double-submit
  clientRequestId: z.string().uuid().optional(),
});

export const contactSchema = z.object({
  name: safeText(80).pipe(z.string().min(2)),
  phone: phoneSchema,
  message: safeText(1000).pipe(z.string().min(5)),
});
```

#### Tracking / loyalty / feedback

```ts
export const trackOrderSchema = z.object({
  orderNumber: z.string().trim().regex(/^ORD-\d{4}-\d{4,}$/),
  phone: phoneSchema,
});

export const loyaltyCheckSchema = z.object({
  phone: phoneSchema,
  // one of: invoice number OR OTP
  invoiceNumber: z.string().regex(/^INV-\d{4}-\d{4,}$/).optional(),
  otp: z.string().regex(/^\d{4,6}$/).optional(),
}).refine((d) => d.invoiceNumber || d.otp, {
  message: "Invoice number or OTP required",
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
```

#### Billing

```ts
export const billingSchema = z
  .object({
    customerName: safeText(80).optional(),
    customerPhone: phoneSchema.optional(),
    paymentMethod: z.enum(["CASH", "UPI", "CARD"]),
    discountType: z.enum(["NONE", "FIXED", "PERCENT"]),
    discountValue: z.number().min(0).max(100000),
    loyaltyRedeem: z.number().int().min(0).max(100000),
    paidAmount: moneySchema,
    items: z
      .array(z.object({ productId: cuidSchema, quantity: qtySchema }))
      .min(1)
      .max(100),
    idempotencyKey: z.string().uuid(), // required for billing
  })
  .superRefine((data, ctx) => {
    if (data.discountType === "PERCENT" && data.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountValue"],
        message: "Percent discount cannot exceed 100",
      });
    }
    if (data.discountType === "NONE" && data.discountValue !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountValue"],
        message: "Discount value must be 0 when type is NONE",
      });
    }
  });
```

**Billing business rules (server, after Zod):**

| Rule | Fail if |
|------|---------|
| Product exists & active | unknown / inactive id |
| Qty ≤ live stock | oversell |
| Prices from DB only | client sent price ignored |
| Bill discount ≤ `settings.maxBillDiscount` | over cap |
| Percent discount ≤ `settings.maxDiscountPercent` | over cap |
| Loyalty redeem ≤ available points | over balance |
| Loyalty redeem ≤ `settings.maxLoyaltyDiscount` | over cap |
| Grand total ≥ 0 | negative total |
| Paid amount ≥ 0 | negative paid |
| Duplicate `idempotencyKey` | return original invoice (no double charge/stock) |
| No duplicate product lines without merge | merge qty or reject |

#### Catalogue admin (product / category / brand / offer)

```ts
export const productUpsertSchema = z
  .object({
    nameEn: safeText(120).pipe(z.string().min(2)),
    nameTa: safeText(120).optional(),
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,20}$/),
    slug: slugSchema,
    categoryId: cuidSchema,
    brandId: cuidSchema.optional().nullable(),
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
    youtubeUrl: youtubeUrlSchema.optional().or(z.literal("")),
    showVideoOnCard: z.boolean().default(true),
    showVideoOnDetails: z.boolean().default(true),
  })
  .refine((d) => d.offerPrice <= d.originalPrice, {
    message: "Offer price cannot exceed original price",
    path: ["offerPrice"],
  });

export const categoryUpsertSchema = z.object({
  nameEn: safeText(80).pipe(z.string().min(2)),
  nameTa: safeText(80).optional(),
  slug: slugSchema,
  description: safeText(300).optional(),
  sortOrder: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
});

export const brandUpsertSchema = z.object({
  nameEn: safeText(80).pipe(z.string().min(2)),
  nameTa: safeText(80).optional(),
  slug: slugSchema,
  taglineEn: safeText(160).optional(),
  saleLabel: safeText(80).optional(),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sortOrder: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
});

export const offerUpsertSchema = z
  .object({
    title: safeText(120).pipe(z.string().min(2)),
    subtitle: safeText(200).optional(),
    type: z.enum([
      "PERCENT",
      "FIXED",
      "COMBO",
      "BUY_MORE",
      "FESTIVAL",
      "CATEGORY_WIDE",
    ]),
    percentOff: percentSchema.optional(),
    fixedOff: moneySchema.optional(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    isActive: z.boolean(),
    productIds: z.array(cuidSchema).max(200).optional(),
    categoryIds: z.array(cuidSchema).max(50).optional(),
  })
  .refine((d) => d.endAt > d.startAt, {
    message: "Offer end must be after start",
    path: ["endAt"],
  });
```

#### Orders / stock / settings

```ts
export const orderStatusSchema = z.enum([
  "ENQUIRY_RECEIVED",
  "ORDER_CONFIRMED",
  "PACKING",
  "PACKED",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
]);

/** Allowed transitions — reject illegal jumps */
export const ORDER_TRANSITIONS: Record<string, string[]> = {
  ENQUIRY_RECEIVED: ["ORDER_CONFIRMED", "CANCELLED"],
  ORDER_CONFIRMED: ["PACKING", "CANCELLED"],
  PACKING: ["PACKED", "CANCELLED"],
  PACKED: ["READY_FOR_PICKUP", "SHIPPED", "CANCELLED"],
  READY_FOR_PICKUP: ["DELIVERED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const orderStatusUpdateSchema = z.object({
  status: orderStatusSchema,
  customerMessage: safeText(500).optional(),
  internalNote: safeText(500).optional(),
  eta: z.coerce.date().optional(),
});

export const stockAdjustSchema = z.object({
  productId: cuidSchema,
  delta: z.number().int().min(-100000).max(100000).refine((n) => n !== 0),
  note: safeText(300).pipe(z.string().min(3)),
});

export const settingsLoyaltySchema = z.object({
  pointsPerHundred: z.number().int().min(0).max(100),
  minRedemptionPoints: z.number().int().min(0).max(100000),
  maxDiscountPercent: percentSchema,
  maxLoyaltyDiscountAmount: moneySchema,
  expiryMonths: z.number().int().min(1).max(60),
  enabled: z.boolean(),
});
```

#### Uploads

```ts
export const imageUploadMetaSchema = z.object({
  filename: z.string().max(120),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(5 * 1024 * 1024),
});
// Server also verifies magic bytes (FF D8 FF / PNG / RIFF WEBP), rejects SVG/HTML.
```

#### List query params

```ts
export const productQuerySchema = paginationSchema.extend({
  category: slugSchema.optional(),
  brand: slugSchema.optional(),
  onOffer: z.coerce.boolean().optional(),
  brandedSale: z.coerce.boolean().optional(),
  inStock: z.coerce.boolean().optional(),
  minPrice: moneySchema.optional(),
  maxPrice: moneySchema.optional(),
  sort: z
    .enum(["newest", "price_asc", "price_desc", "discount_desc"])
    .default("newest"),
});
```

### 8.3 Full validation matrix (enterprise)

| Area | Schema | Business rules | Rate limit | Audit |
|------|--------|----------------|------------|-------|
| Login | `loginSchema` | lock after 5 fails / 15m; generic errors | Strict | ✓ |
| Password set | `passwordPolicySchema` | not equal to email; history optional later | — | ✓ |
| Enquiry | `enquirySchema` | products active; qty>0; idempotent | Medium | — |
| Contact | `contactSchema` | — | Medium | — |
| Track order | `trackOrderSchema` | phone must match order | Strict | — |
| Loyalty check | `loyaltyCheckSchema` | invoice/OTP verify; no user enum | Strict | — |
| Feedback | `feedbackSchema` | order DELIVERED + phone match; once only | Medium | — |
| Billing | `billingSchema` | stock, discount, loyalty, idempotency | Medium | ✓ |
| Product CRUD | `productUpsertSchema` | unique code/slug; offer≤original | Soft | ✓ |
| Category/Brand | upsert schemas | unique slug | Soft | ✓ |
| Offers | `offerUpsertSchema` | end>start; %/fixed consistent with type | Soft | ✓ |
| Order status | `orderStatusUpdateSchema` | transition map only; DELIVERED sets timestamp | Soft | ✓ |
| Proof upload | `imageUploadMetaSchema` | MIME + magic bytes + 5MB | Soft | ✓ |
| Stock adjust | `stockAdjustSchema` | resulting stock ≥ 0 | Soft | ✓ |
| Settings | `settingsLoyaltySchema` | ranges | Soft | ✓ |
| Public invoice | token format | token exists; mask phone | Soft | — |
| Product list | `productQuerySchema` | pageSize ≤ 100 | Soft | — |

### 8.4 Error response standard

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "fields": {
      "phone": ["Invalid Indian mobile number"],
      "items.0.quantity": ["Must be at least 1"]
    },
    "requestId": "req_..."
  }
}
```

Codes: `VALIDATION_ERROR` · `UNAUTHORIZED` · `FORBIDDEN` · `NOT_FOUND` · `CONFLICT` · `RATE_LIMITED` · `BUSINESS_RULE` · `INTERNAL_ERROR`

### 8.5 Output sanitization & PII

| Surface | Rule |
|---------|------|
| All text inputs | Strip HTML + control chars (`safeText`) |
| Public invoice | Mask phone `******XXXX`; hide address, internal notes, cashier internals |
| Loyalty/track failures | Same generic message (no “phone not found” vs “wrong OTP”) |
| Logs | Never log passwords, session cookies, full PAN-like fields |
| Admin list APIs | Role-filter fields (Cashier cannot see cost/settings) |

### 8.6 Implementation status checklist

| Item | In design doc | In runtime code |
|------|---------------|-----------------|
| Shared Zod primitives | ✓ | ✗ Not built |
| Enquiry / billing / login schemas | ✓ | ✗ |
| Order status transition map | ✓ | ✗ |
| Idempotency on billing | ✓ | ✗ |
| Upload MIME + magic bytes | ✓ | ✗ |
| Rate limits on public sensitive APIs | ✓ | ✗ |
| Field-level error responses | ✓ | ✗ |
| UI client-side hints only | ✓ (forms) | Partial (HTML `required` only) |

**Verdict:** Enterprise validation is **fully specified** in this document. It is **not yet wired into the application**. Treat §8 as the mandatory build checklist for the validation layer (`src/lib/validation/`).

---

## 9. Security design

### 9.1 Authentication (admin)

```text
POST /api/admin/login
  → verify Argon2id(passwordHash)
  → check isActive, lockedUntil
  → reset failedLogins on success
  → set encrypted HTTP-only cookie (Secure, SameSite=Lax, Path=/)
  → audit LOGIN_SUCCESS

On failure:
  → increment failedLogins
  → lock account after 5 failures for 15 minutes
  → generic error message (no user enumeration)
```

**Cookie properties**

| Flag | Value |
|------|-------|
| HttpOnly | true |
| Secure | true (production) |
| SameSite | Lax |
| Max-Age | 8–12 hours (shift-friendly) |
| Payload | `{ userId, role, exp }` sealed with `SESSION_SECRET` |

### 9.2 Authorization (RBAC)

| Capability | Admin | Cashier |
|------------|-------|---------|
| Dashboard / reports | ✓ | Limited (own invoices optional) |
| Products / categories / brands / offers | ✓ | ✗ |
| Delete catalogue | ✓ | ✗ |
| Enquiries / orders / proofs | ✓ | ✗ |
| Billing + invoices | ✓ | ✓ |
| Stock adjust | ✓ | View only |
| Loyalty redeem at bill | ✓ | ✓ |
| Loyalty rule settings | ✓ | ✗ |
| System settings / users | ✓ | ✗ |

Enforce in **middleware + each handler** (never UI-only).

### 9.3 Encryption & cryptography

| Data | Approach |
|------|----------|
| In transit | HTTPS/TLS only (Vercel + force HTTPS) |
| Passwords at rest | Argon2id hash (+ optional pepper) — **not reversible encryption** |
| Session cookie | Authenticated encryption (iron-session / sealed box) |
| DB disk | Supabase encryption at rest (provider-managed) |
| Public invoice URL | Random `publicToken` (128-bit) — not sequential invoice number alone |
| Signed file URLs | Short TTL (e.g. 5–15 min) for proofs |
| Backups | Encrypted backups via provider; access restricted |

**Do not encrypt** product names/prices with app-level crypto (hurts search).  
**Do hash** passwords.  
**Do tokenize** public invoice access.

Optional later (PII hardening):

- Encrypt `customers.address` with AES-256-GCM using KMS-managed key if compliance requires.
- Store only last-4 display form for public surfaces.

### 9.4 Application security controls

| Control | Implementation |
|---------|----------------|
| CSRF | SameSite cookies + origin check on mutations |
| XSS | React escaping; no `dangerouslySetInnerHTML`; CSP headers |
| SQL injection | Prisma parameterized queries only |
| SSRF / iframe abuse | YouTube ID allowlist only — never raw HTML embeds from admin |
| File upload | MIME + size + random object key; private bucket |
| Rate limiting | Login: 5/15min/IP; Tracking/Loyalty: 10/min/IP |
| Audit log | All admin writes (who, what, when, IP) |
| Headers | `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP |
| Dependency safety | `npm audit` in CI; lockfile committed |

### 9.5 Data classification

| Class | Examples | Handling |
|-------|----------|----------|
| Public | Product catalogue, offers, brand pages | Cacheable |
| Internal | Stock, costs (if added), admin notes | Admin auth |
| PII | Name, phone, address | Minimize; mask on public invoice |
| Secret | Password hashes, session secret, service keys | Server-only env |
| Evidence | Delivery proof images | Private storage + signed URLs |

---

## 10. WhatsApp integration design

MVP uses **prepared deep links** (no official WhatsApp Business API required yet).

```text
https://wa.me/{number}?text={urlencoded_template}
```

Templates (server-generated, never fully client-authored for invoices):

- Enquiry acknowledgement  
- Order status update + tracking URL  
- Invoice share + public invoice URL  

**Future:** WhatsApp Cloud API with template messages + webhook delivery receipts.

---

## 11. Observability & operations

| Area | Design |
|------|--------|
| Logging | Structured JSON logs (requestId, userId, route, latency) — no PII in plain logs |
| Errors | Sentry (or Vercel monitoring) for server exceptions |
| Metrics | Daily sales query, enquiry conversion, failed logins |
| Backups | Supabase automated PITR; monthly restore drill |
| Migrations | Prisma migrate in CI; never edit prod schema manually |
| Feature flags | Settings table for loyalty enable/disable |

---

## 12. UI ↔ backend mapping (implementation checklist)

| UI route | Backend dependency |
|----------|--------------------|
| `/`, `/products`, `/brands` | GET products/categories/brands/offers |
| `/enquiry` | POST `/api/enquiries` |
| `/track-order` | POST `/api/order-tracking` |
| `/loyalty` | POST `/api/loyalty/check` |
| `/invoice/[token]` | GET `/api/public/invoices/:token` |
| `/admin/login` | POST `/api/admin/login` |
| `/admin/dashboard` | GET `/api/admin/dashboard` |
| `/admin/billing` | POST `/api/admin/invoices` + stock/loyalty TX |
| `/admin/orders/[id]` | PUT status + POST proof |
| `/admin/products` | CRUD + video validation |
| `/admin/reports/daily` | Aggregations by date/payment/cashier |

---

## 13. Gap analysis — what is still missing

### Already covered in UI design

- Customer storefront, brands, offers, enquiry, tracking, loyalty UI  
- Admin panel, billing UI, invoices, stock, feedback, settings UI  
- Public invoice page (masked phone in mock)

### Must build next (backend)

1. Prisma schema + migrations  
2. All public + admin APIs  
3. Real auth/session + RBAC middleware  
4. Zod validation layer  
5. Supabase storage for images/proofs  
6. Transactional billing + stock + loyalty  
7. Audit logs  
8. Rate limiting  
9. next-intl EN/TA wiring to DB translations  
10. WhatsApp message generators (server)  
11. Automated tests (unit Zod + API integration + billing TX)  
12. CI (`lint`, `typecheck`, `test`, `build`)  
13. Production env + domain + HTTPS  
14. Capacitor Android wrapper  

### Explicitly out of MVP (do not add yet)

- Online payment gateway  
- Courier API / shipping rates  
- Customer login/password dashboard  
- Native iOS app  
- Full WhatsApp Cloud API automation  

---

## 14. Recommended implementation sequence

| Phase | Deliverable | Exit criteria |
|-------|-------------|---------------|
| **P0** | Prisma schema + seed + env | DB migrates cleanly |
| **P1** | Admin auth + RBAC middleware | Unauthenticated `/admin/*` blocked |
| **P2** | Catalogue APIs (products, brands, categories, offers) | Storefront reads from DB |
| **P3** | Enquiry + tracking + loyalty check | End-to-end public flows |
| **P4** | Billing TX + invoices + public token | Stock & points correct |
| **P5** | Orders status + proof upload + WhatsApp templates | Tracking updates work |
| **P6** | Hardening: rate limits, CSP, audit, tests, deploy | Security checklist pass |

---

## 15. Security acceptance checklist

- [ ] Passwords hashed with Argon2id/bcrypt; never logged  
- [ ] Session cookie HttpOnly + Secure + SameSite  
- [ ] Admin/Cashier RBAC enforced server-side  
- [ ] All inputs Zod-validated  
- [ ] Client prices ignored on billing  
- [ ] Stock updates transactional; no negatives  
- [ ] Public invoice uses unguessable token; phone masked  
- [ ] Proof images private; signed URLs only  
- [ ] YouTube URLs validated; no arbitrary iframe HTML  
- [ ] Login + tracking rate-limited  
- [ ] Audit log for admin mutations  
- [ ] No secrets in client bundles  
- [ ] HTTPS only in production  
- [ ] `npm audit` clean / accepted risks documented  

---

## 16. Definition of backend done

Backend is complete when:

1. Storefront and admin UI use live APIs (mock data removed).  
2. Enquiry → order → track → deliver → feedback works with DB.  
3. Billing reduces stock, writes invoice, awards loyalty.  
4. Public invoice link works securely.  
5. Admin auth + RBAC + validation + encryption/hashing controls above are active.  
6. `npm run lint`, `typecheck`, `test`, and `build` pass.  
7. Staging deploy on Vercel + Supabase succeeds with HTTPS.

---

## 17. Document ownership

| Role | Responsibility |
|------|----------------|
| Product | Confirm loyalty rules and offer policies |
| Engineering | Implement schema, APIs, security controls |
| Ops | Env secrets, backups, monitoring |
| Store owner | Admin users, WhatsApp number, shop settings |

---

*End of technical design document.*
