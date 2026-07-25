# SparkNova Crackers — Complete Project Master Document

**Product:** Premium cracker business platform (customer + admin + billing)  
**Version:** 2.0 · Complete Blueprint  
**Date:** 20 Jul 2026  
**Brand:** SparkNova Crackers  
**Status:** UI prototype live · Backend/security designed · Ready for full build  

This is the **single source of truth** for the entire project: business flow, frontend, backend, database, API, validation, security, encryption, WhatsApp, deployment, and delivery checklist.

---

# PART A — Product & Business

## A1. Project goal

Build a modern, mobile-first cracker business platform with:

1. Customer website (catalogue, brands, offers, enquiry)
2. Loyalty points (mobile number based — no login)
3. Live order tracking
4. WhatsApp Business communication (prepared messages)
5. Admin panel (catalogue, enquiries, orders, stock)
6. Billing / POS + invoice history + online invoice link
7. English + Tamil languages
8. Enterprise security, validation, and encryption

## A2. Core business flow

```text
Customer opens website
  → Views categories / brands / products / offers
  → Adds products to enquiry cart
  → Enters name + phone (no account)
  → Submits enquiry
  → Admin confirms enquiry
  → Admin creates order and/or bill
  → Customer gets order number + tracking link
  → Admin updates status (+ optional proof image)
  → Customer gets WhatsApp update
  → Order delivered
  → Customer feedback
  → Loyalty points added to mobile number
```

## A3. Explicitly NOT in MVP

- Online payment gateway
- Courier / shipping-rate APIs
- Customer login / password / dashboard
- Native iOS app
- Full WhatsApp Cloud API automation (deep links only in MVP)

## A4. Design principles

1. No customer accounts — identity = mobile + order/invoice/enquiry numbers  
2. Enquiry ≠ payment — website never collects UPI/card credentials  
3. Server-side authority — prices, stock, discounts, loyalty computed on server  
4. Least privilege — Cashier ≠ Admin  
5. Defence in depth — TLS + hashing + cookies + Zod + RBAC + rate limits + audit  

---

# PART B — Technology Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind CSS + Framer Motion |
| UI components | Custom + shadcn/ui patterns |
| i18n | next-intl (`en`, `ta`) |
| Backend | Next.js Route Handlers + Server Actions |
| ORM | Prisma |
| Database | PostgreSQL (Supabase) |
| Files | Supabase Storage (private buckets + signed URLs) |
| Auth | Encrypted HTTP-only session cookie (iron-session / sealed) |
| Password hash | Argon2id (or bcrypt cost ≥ 12) |
| Validation | Zod (shared schemas) |
| Rate limit | Upstash Redis / Vercel KV |
| Hosting | Vercel (app) + Supabase (DB/storage) |
| Mobile | Capacitor Android WebView wrapper |
| Source | GitHub |

---

# PART C — Frontend (Complete UI Map)

## C1. Design system

| Token | Value | Use |
|-------|-------|-----|
| Background | `#f7f8fb` | Light enterprise surface |
| Surface | `#ffffff` | Cards / panels |
| Navy | `#0f2744` | Brand / primary text |
| Amber | `#c45c16` | CTA / sales urgency |
| Success | `#1a7a4c` | Stock / success |
| Danger | `#c53030` | Discount / errors |
| Fonts | Fraunces (display) + Manrope (body) | Premium, non-generic |

**Feel:** Festive, premium, trustworthy, light, mobile-first, sales-driven.  
**Avoid:** Dark-mode default, purple gradients, continuous fireworks, autoplay audio.

## C2. Customer storefront routes

| Route | Purpose | Status |
|-------|---------|--------|
| `/` | Home — hero, offers, brands, categories, featured, loyalty, how-to, reviews | UI ✓ |
| `/products` | Catalogue + filters (category, brand, offer, stock, sort) | UI ✓ |
| `/products/[slug]` | Product detail, gallery, video, qty, enquiry, safety | UI ✓ |
| `/brands` | Branded product sales showcase | UI ✓ |
| `/brands/[slug]` | Single brand sale + products | UI ✓ |
| `/offers` | Festival / combo / category offers | UI ✓ |
| `/enquiry` | Enquiry cart + customer form + success | UI ✓ |
| `/track-order` | Track by order# + mobile + timeline | UI ✓ |
| `/loyalty` | Check points by mobile | UI ✓ |
| `/contact` | Shop details + contact form | UI ✓ |
| `/invoice/[token]` | Public invoice (masked phone) | UI ✓ |

**Chrome:** Header (search, EN/TA, enquiry, WhatsApp), footer, sticky enquiry bar (mobile), WhatsApp FAB.

## C3. Admin panel routes

| Route | Purpose | Roles | Status |
|-------|---------|-------|--------|
| `/admin/login` | Secure login UI | — | UI ✓ |
| `/admin/dashboard` | Sales, enquiries, packing, low stock, top sellers | Admin | UI ✓ |
| `/admin/billing` | POS search, cart, discount, loyalty, payment, print/WhatsApp | Admin, Cashier | UI ✓ |
| `/admin/products` | Catalogue list | Admin | UI ✓ |
| `/admin/products/new` | Add product + YouTube video | Admin | UI ✓ |
| `/admin/products/[id]/edit` | Edit product | Admin | UI ✓ |
| `/admin/categories` | Category management | Admin | UI ✓ |
| `/admin/offers` | Offer management | Admin | UI ✓ |
| `/admin/stock` | Stock adjust + low-stock alerts | Admin | UI ✓ |
| `/admin/enquiries` | Enquiry queue, WhatsApp, convert | Admin | UI ✓ |
| `/admin/orders` | Order list | Admin | UI ✓ |
| `/admin/orders/[id]` | Status update, proof, WhatsApp | Admin | UI ✓ |
| `/admin/invoices` | Invoice history, send bill | Admin, Cashier | UI ✓ |
| `/admin/invoices/[id]` | Invoice detail / print | Admin, Cashier | UI ✓ |
| `/admin/loyalty` | Points accounts + rules | Admin | UI ✓ |
| `/admin/feedback` | Customer ratings | Admin | UI ✓ |
| `/admin/reports/daily` | Daily sales by Cash/UPI/Card | Admin | UI ✓ |
| `/admin/settings` | Shop, loyalty, languages | Admin | UI ✓ |

## C4. Frontend folder structure (target)

```text
src/
  app/
    (store)/          # customer layout + pages
    admin/            # admin layout + pages
    invoice/          # public invoice
    api/              # Route Handlers
  components/
    admin/
    store/
  lib/
    data.ts           # temporary mocks (remove after API)
    admin-data.ts
    prisma.ts
    auth/
    validation/       # Zod schemas (enterprise)
    security/
    whatsapp/
  messages/
    en.json
    ta.json
prisma/
  schema.prisma
  migrations/
docs/
  COMPLETE_PROJECT.md  # this file
```

## C5. Key UX behaviours

- Product card: image, brand chip, discount badge, brand-sale badge, stock, Add to enquiry, View  
- Optional YouTube: thumbnail first; iframe loads only after click; no autoplay  
- Enquiry: not checkout; no payment  
- Tracking: timeline animation; “I Received My Order” after delivery  
- Billing: split search + cart; recalculate totals live; print A4 / 80mm / WhatsApp  

---

# PART D — Backend Architecture

## D1. System diagram

```text
Customer Web / Admin / Android WebView
                │ HTTPS TLS 1.2+
                ▼
        Next.js (Vercel)
   pages · /api · server actions · middleware
         │            │            │
         ▼            ▼            ▼
   PostgreSQL    Supabase      Env secrets
   (Prisma)      Storage       SESSION_SECRET
                               DATABASE_URL
                               SERVICE_ROLE
```

## D2. Environment variables

```bash
DATABASE_URL=
DIRECT_URL=
SESSION_SECRET=                 # ≥ 32 random bytes
SESSION_COOKIE_NAME=sn_admin_session
PASSWORD_PEPPER=                # optional
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=      # server-only — NEVER NEXT_PUBLIC_
STORAGE_BUCKET_PRODUCTS=products
STORAGE_BUCKET_PROOFS=order-proofs
STORAGE_BUCKET_INVOICES=invoices
NEXT_PUBLIC_APP_URL=https://yourdomain.com
WHATSAPP_BUSINESS_NUMBER=91XXXXXXXXXX
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## D3. Database tables

```text
admin_users
brands
categories
products
product_images
product_videos
offers
offer_products
customers
enquiries
enquiry_items
orders
order_items
order_status_history
order_proof_images
invoices
invoice_items
stock_transactions
loyalty_accounts
loyalty_transactions
feedback
settings
translations
audit_logs
```

## D4. Critical DB rules

| Rule | How |
|------|-----|
| Money | `Decimal(12,2)` — never float |
| Stock | `CHECK (stock >= 0)` + transactional lock |
| Phones | Unique normalized (`91` + 10 digits) |
| Invoice access | `publicToken` (128-bit random), not sequential number alone |
| Soft cancel | `cancelledAt` on invoices; prefer `isActive` over hard delete |
| Indexes | slug, code, brand+sale, order number+phone, invoice createdAt |

## D5. Public APIs

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/categories` | Active only |
| GET | `/api/brands` | Active + sale labels |
| GET | `/api/brands/:slug` | Brand + products |
| GET | `/api/products` | Filters: category, brand, q, price, offer, brandedSale, sort, page |
| GET | `/api/products/:slug` | Detail |
| GET | `/api/offers` | In date window |
| POST | `/api/enquiries` | Create enquiry |
| POST | `/api/order-tracking` | order# + phone — **strict rate limit** |
| POST | `/api/loyalty/check` | phone + invoice/OTP — **strict** |
| GET | `/api/public/invoices/:token` | Masked phone |
| POST | `/api/feedback` | After delivery |
| POST | `/api/contact` | Contact form |

## D6. Admin APIs

| Method | Path | Role |
|--------|------|------|
| POST | `/api/admin/login` | — |
| POST | `/api/admin/logout` | Any |
| GET | `/api/admin/me` | Any |
| GET | `/api/admin/dashboard` | Admin |
| CRUD | `/api/admin/products` | Admin |
| CRUD | `/api/admin/categories` | Admin |
| CRUD | `/api/admin/brands` | Admin |
| CRUD | `/api/admin/offers` | Admin |
| GET/PUT | `/api/admin/enquiries` | Admin |
| POST | `/api/admin/enquiries/:id/convert-order` | Admin |
| GET/PUT | `/api/admin/orders` | Admin |
| POST | `/api/admin/orders/:id/proof` | Admin |
| POST/GET | `/api/admin/invoices` | Admin, Cashier |
| POST | `/api/admin/stock/adjust` | Admin |
| GET | `/api/admin/reports/daily` | Admin |
| GET/PUT | `/api/admin/loyalty` | Admin |
| GET | `/api/admin/feedback` | Admin |
| GET/PUT | `/api/admin/settings` | Admin only |

## D7. Billing transaction (must be atomic)

```text
BEGIN
  1. Auth + Zod validate + idempotency key
  2. Lock product rows (FOR UPDATE)
  3. qty ≤ stock
  4. Recompute prices from DB (ignore client prices)
  5. Discount ≤ settings max
  6. Loyalty redeem ≤ available + max cap
  7. Insert invoice + items
  8. Decrement stock + stock_transactions
  9. Upsert loyalty + earn points
  10. Audit log
COMMIT
→ return invoice number, publicToken, WhatsApp text
```

---

# PART E — Validation (Enterprise Complete)

## E1. Validation layers

```text
1. Transport   → HTTPS, body size limits
2. Schema      → Zod types / lengths / enums
3. Business    → stock, discounts, loyalty, status transitions
4. AuthZ       → Admin vs Cashier
5. DB          → unique / FK / check constraints
6. Output      → mask PII, standard error shape
```

## E2. Shared primitives

- `phoneSchema` — Indian mobile → normalize to `91XXXXXXXXXX`  
- `emailSchema` — trim, lowercase, max 120  
- `slugSchema` — `a-z0-9-` only  
- `moneySchema` — ≥0, max 9,999,999.99, 2 decimals  
- `percentSchema` — 0–100  
- `qtySchema` — int 1–999  
- `safeText(max)` — strip HTML + control chars  
- `youtubeUrlSchema` — YouTube watch / shorts / youtu.be only  
- `paginationSchema` — page ≥1, pageSize ≤100  

## E3. Domain schemas required

| Schema | Key rules |
|--------|-----------|
| `loginSchema` | user + password 8–128 |
| `passwordPolicySchema` | ≥10, upper, lower, digit, special |
| `enquirySchema` | name, phone, WhatsApp, city, ≥1 item, max 50 lines, optional UUID idempotency |
| `contactSchema` | name, phone, message 5–1000 |
| `trackOrderSchema` | `ORD-YYYY-####` + phone match |
| `loyaltyCheckSchema` | phone + (invoice OR OTP) |
| `feedbackSchema` | ratings 1–5 ×5 dimensions; order delivered; once |
| `billingSchema` | items, payment enum, discount rules, **required idempotencyKey** |
| `productUpsertSchema` | code unique pattern; offer ≤ original; stock ≥0 |
| `categoryUpsertSchema` / `brandUpsertSchema` | slug unique |
| `offerUpsertSchema` | endAt > startAt |
| `orderStatusUpdateSchema` | only allowed transitions |
| `stockAdjustSchema` | delta ≠ 0; resulting stock ≥ 0 |
| `settingsLoyaltySchema` | rate / min redeem / max % / expiry months |
| `imageUploadMetaSchema` | jpeg/png/webp ≤5MB + magic-byte check |
| `productQuerySchema` | filters + sort whitelist |

## E4. Order status state machine

```text
ENQUIRY_RECEIVED → ORDER_CONFIRMED → PACKING → PACKED
  → READY_FOR_PICKUP | SHIPPED → OUT_FOR_DELIVERY → DELIVERED
Any active → CANCELLED
DELIVERED / CANCELLED → (terminal)
```

Illegal jumps must return `BUSINESS_RULE` error.

## E5. Standard error shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "fields": { "phone": ["Invalid Indian mobile number"] },
    "requestId": "req_..."
  }
}
```

Codes: `VALIDATION_ERROR` · `UNAUTHORIZED` · `FORBIDDEN` · `NOT_FOUND` · `CONFLICT` · `RATE_LIMITED` · `BUSINESS_RULE` · `INTERNAL_ERROR`

## E6. Implementation target path

```text
src/lib/validation/
  primitives.ts
  auth.ts
  enquiry.ts
  billing.ts
  catalogue.ts
  orders.ts
  public.ts
  index.ts
```

Every API handler: `schema.parse(body)` before business logic.

---

# PART F — Security & Encryption

## F1. Authentication (admin)

```text
POST /api/admin/login
  → Argon2id verify
  → check isActive + lockedUntil
  → on fail: failedLogins++; lock after 5 / 15 minutes
  → on success: sealed HttpOnly cookie
  → audit LOGIN_SUCCESS / LOGIN_FAIL
```

| Cookie flag | Value |
|-------------|-------|
| HttpOnly | true |
| Secure | true (production) |
| SameSite | Lax |
| Max-Age | 8–12 hours |
| Payload | `{ userId, role, exp }` encrypted with `SESSION_SECRET` |

## F2. RBAC

| Capability | Admin | Cashier |
|------------|-------|---------|
| Dashboard / daily reports | ✓ | Limited |
| Products / categories / brands / offers | ✓ | ✗ |
| Delete catalogue | ✓ | ✗ |
| Enquiries / orders / proofs | ✓ | ✗ |
| Billing + invoices | ✓ | ✓ |
| Stock adjust | ✓ | View only |
| Loyalty redeem on bill | ✓ | ✓ |
| Loyalty / system settings | ✓ | ✗ |

Enforce in **middleware + every handler** (never UI-only).

## F3. Encryption & crypto map

| Data | Method |
|------|--------|
| In transit | HTTPS / TLS only |
| Passwords | Argon2id hash (+ optional pepper) — not reversible |
| Session | Authenticated encryption (sealed cookie) |
| DB disk | Provider encryption at rest (Supabase) |
| Public invoice | Unguessable `publicToken` |
| Proof / invoice files | Private bucket + short-lived signed URLs |
| Optional later | AES-256-GCM for address if compliance requires |

## F4. App security controls

| Control | Detail |
|---------|--------|
| CSRF | SameSite + origin check on mutations |
| XSS | React escaping; CSP; no raw HTML from users |
| SQLi | Prisma only |
| YouTube | Extract video ID only — never admin-supplied iframe HTML |
| Uploads | MIME whitelist + magic bytes + random keys |
| Rate limits | Login 5/15m; track/loyalty 10/min/IP |
| Audit | All admin writes (who, what, when, IP) |
| Headers | `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP |
| Secrets | Never `NEXT_PUBLIC_` for keys |

## F5. Data classification

| Class | Examples | Handling |
|-------|----------|----------|
| Public | Catalogue, offers, brands | Cache OK |
| Internal | Stock, admin notes | Auth required |
| PII | Name, phone, address | Minimize; mask on public invoice |
| Secret | Password hashes, session secret | Server env only |
| Evidence | Delivery proofs | Private storage |

## F6. PII output rules

- Public invoice: `******3210` style mask  
- No address / internal notes on public link  
- Loyalty/track errors: generic message (no user enumeration)  
- Logs: no passwords, cookies, or full secrets  

---

# PART G — WhatsApp

MVP = prepared deep links (no Cloud API required):

```text
https://wa.me/{number}?text={urlencoded_template}
```

Templates (server-generated):

1. Enquiry received acknowledgement  
2. Order status update + tracking URL  
3. Invoice share + public invoice URL  

Example status message:

```text
Hello {{customer_name}},
Your order {{order_number}} has been updated.
Current status: {{status}}
Message: {{admin_message}}
Track: {{tracking_url}}
Thank you.
```

---

# PART H — Languages

- EN + TA in v1 (Hindi/Telugu/Malayalam later)  
- Header language selector; remember preference  
- Translate menus, buttons, system messages  
- Product/category names: separate `nameEn` / `nameTa` fields  
- Files: `messages/en.json`, `messages/ta.json`  

---

# PART I — Implementation Status

| Area | Status |
|------|--------|
| Customer UI | ✓ Built |
| Admin UI | ✓ Built |
| Billing UI | ✓ Built + live API save |
| Brands / branded sales UI | ✓ Built + DB |
| Design system (light enterprise) | ✓ Built |
| Technical design docs | ✓ Written |
| Prisma schema / SQLite DB | ✓ Built + seeded |
| Real APIs (public + admin) | ✓ Built |
| Zod validation package | ✓ Built (`src/lib/validation`) |
| Auth / RBAC / sessions | ✓ Built (iron-session + bcrypt) |
| Encryption / hashing live | ✓ Password hash + sealed cookie |
| Rate limiting | ✓ In-memory (Redis-ready) |
| Audit logs | ✓ On login / billing / stock / orders |
| Middleware security headers | ✓ Built |
| next-intl EN/TA | Partial (selector UI; full i18n later) |
| Capacitor Android | ✗ Not done |
| Production Vercel/Supabase | ✗ Use `.env.example` for Postgres cutover |

**Local preview:** `http://localhost:3000`  
**Admin:** `admin@sparknova.in` / `Admin@12345`  
**Cashier:** `cashier@sparknova.in` / `Cashier@12345`  

---

# PART J — Build Sequence (Best Path)

| Phase | Work | Done when |
|-------|------|-----------|
| **P0** | Prisma schema + seed + env | DB migrates |
| **P1** | Admin auth + RBAC middleware | `/admin` protected |
| **P2** | Validation package (`src/lib/validation`) | All schemas exported + unit tests |
| **P3** | Catalogue APIs (products, brands, categories, offers) | Storefront reads DB |
| **P4** | Enquiry + tracking + loyalty + feedback APIs | Public flows live |
| **P5** | Billing TX + invoices + public token | Stock & points correct |
| **P6** | Orders status + proof upload + WhatsApp templates | Tracking updates |
| **P7** | Hardening: rate limits, CSP, audit, i18n, tests, deploy | Security checklist green |
| **P8** | Capacitor Android wrapper | APK opens site |

---

# PART K — Security Acceptance Checklist

- [ ] Passwords hashed (Argon2id/bcrypt); never logged  
- [ ] Session cookie HttpOnly + Secure + SameSite  
- [ ] Admin/Cashier RBAC enforced server-side  
- [ ] Every input Zod-validated  
- [ ] Client prices ignored on billing  
- [ ] Billing idempotent; stock transactional; no negatives  
- [ ] Public invoice uses token; phone masked  
- [ ] Proof images private; signed URLs only  
- [ ] YouTube URL validated; no arbitrary iframes  
- [ ] Login + tracking + loyalty rate-limited  
- [ ] Audit log for admin mutations  
- [ ] No secrets in client bundles  
- [ ] HTTPS only in production  
- [ ] Order status transitions enforced  
- [ ] `lint` · `typecheck` · `test` · `build` pass  

---

# PART L — Definition of Done (Full Project)

The project is complete when:

1. Customer browses products/brands/offers from live DB  
2. Customer submits enquiry; admin confirms; order created  
3. Customer tracks order; admin uploads proof; WhatsApp text ready  
4. Customer confirms delivery + feedback; loyalty points update  
5. Cashier/Admin creates bill; stock reduces; invoice printable + shareable  
6. Public invoice link works securely  
7. EN + TA work  
8. Admin authorization works  
9. All enterprise validations and security controls above are live  
10. Mobile layout works; Android wrapper opens  
11. Production build + HTTPS domain live  

---

# PART M — Ownership

| Role | Owns |
|------|------|
| Product / shop owner | Offers, loyalty rules, WhatsApp number, content |
| Engineering | Schema, APIs, validation, security, UI wiring |
| Ops | Secrets, backups, monitoring, deploy |

---

# Quick reference — important URLs (local)

| URL | What |
|-----|------|
| `/` | Storefront home |
| `/brands` | Branded sales |
| `/admin/login` | Admin login |
| `/admin/billing` | POS billing |
| `/admin/dashboard` | Admin overview |
| `/invoice/INV-2026-0042` | Sample public invoice |

---

*End of Complete Project Master Document — SparkNova Crackers v2.0*  
*Related detail file: `docs/TECHNICAL_DESIGN.md` (expanded schemas & Prisma notes)*
