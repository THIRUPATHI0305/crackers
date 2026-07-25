/**
 * Full project smoke + case tests against running server.
 * Run: npx tsx scripts/smoke-test.ts
 *
 * Optional: TEST_BASE_URL, TEST_PHONE (10-digit Indian mobile)
 */
import { randomUUID } from "crypto";
import { phoneSchema } from "../src/lib/validation";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
/** 10-digit mobile used in enquiry / track / loyalty cases — override via TEST_PHONE */
const TEST_PHONE_10 = phoneSchema.parse(
  process.env.TEST_PHONE || "9000012345"
).slice(2);
const TEST_PHONE_E164 = `91${TEST_PHONE_10}`;

type Result = { name: string; ok: boolean; detail?: string };

const results: Result[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail?: string) {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function req(
  path: string,
  init?: RequestInit & { cookie?: string }
) {
  const headers = new Headers(init?.headers);
  if (init?.cookie) headers.set("cookie", init.cookie);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  const setCookie = res.headers.getSetCookie?.() || [];
  return { res, json, setCookie, status: res.status };
}

function cookieFrom(setCookie: string[]) {
  return setCookie.map((c) => c.split(";")[0]).join("; ");
}

async function getCsrf() {
  const { status, json, setCookie } = await req("/api/csrf");
  const token = (json as { csrfToken?: string })?.csrfToken || "";
  const cookie = cookieFrom(setCookie);
  if (status !== 200 || !token || !cookie) {
    throw new Error(`CSRF issue failed: ${status}`);
  }
  return { token, cookie };
}

async function csrfPost(
  path: string,
  body: unknown,
  csrf?: { token: string; cookie: string }
) {
  const c = csrf || (await getCsrf());
  return req(path, {
    method: "POST",
    cookie: c.cookie,
    headers: { "x-csrf-token": c.token },
    body: JSON.stringify(body),
  });
}

async function sendOtp(phone: string, purpose: string, email = "test@example.com") {
  const csrf = await getCsrf();
  const { status, json } = await csrfPost(
    "/api/otp/send",
    { phone, email, purpose },
    csrf
  );
  const data = json as {
    challengeId?: string;
    debugCode?: string;
    error?: unknown;
  };
  if (status !== 200 || !data.challengeId || !data.debugCode) {
    throw new Error(`OTP send failed: ${status} ${JSON.stringify(json)}`);
  }
  return {
    csrf,
    challengeId: data.challengeId,
    otp: data.debugCode,
    email,
  };
}

async function main() {
  console.log(`\nSmoke tests → ${BASE}\n`);

  // —— Pages ——
  for (const path of [
    "/",
    "/products",
    "/brands",
    "/offers",
    "/enquiry",
    "/track-order",
    "/loyalty",
    "/contact",
    "/admin/login",
  ]) {
    const { status } = await req(path);
    if (status === 200) pass(`PAGE ${path}`, String(status));
    else fail(`PAGE ${path}`, `status ${status}`);
  }

  // Admin protected should redirect to login when logged out
  {
    const res = await fetch(`${BASE}/admin/dashboard`, { redirect: "manual" });
    if (res.status === 307 || res.status === 302 || res.status === 303) {
      const loc = res.headers.get("location") || "";
      if (loc.includes("/admin/login"))
        pass("AUTH redirect unauthenticated /admin/dashboard");
      else fail("AUTH redirect", `location=${loc}`);
    } else if (res.status === 200) {
      fail("AUTH redirect", "dashboard accessible without login");
    } else {
      fail("AUTH redirect", `status ${res.status}`);
    }
  }

  // —— Public catalogue APIs ——
  {
    const { status, json } = await req("/api/categories");
    const cats = (json as { categories?: unknown[] })?.categories;
    if (status === 200 && Array.isArray(cats) && cats.length > 0)
      pass("GET /api/categories", `${cats.length} items`);
    else fail("GET /api/categories", JSON.stringify(json));
  }
  {
    const { status, json } = await req("/api/brands");
    const brands = (json as { brands?: unknown[] })?.brands;
    if (status === 200 && Array.isArray(brands) && brands.length > 0)
      pass("GET /api/brands", `${brands.length} items`);
    else fail("GET /api/brands", JSON.stringify(json));
  }
  {
    const { status, json } = await req("/api/offers");
    const offers = (json as { offers?: unknown[] })?.offers;
    if (status === 200 && Array.isArray(offers))
      pass("GET /api/offers", `${offers.length} items`);
    else fail("GET /api/offers", JSON.stringify(json));
  }

  let productId = "";
  let productSlug = "";
  {
    const { status, json } = await req("/api/products?pageSize=10");
    const products = (json as { products?: { id: string; slug: string }[] })
      ?.products;
    if (status === 200 && products?.length) {
      productId = products[0].id;
      productSlug = products[0].slug;
      pass("GET /api/products", `${products.length} items`);
    } else fail("GET /api/products", JSON.stringify(json));
  }
  if (productSlug) {
    const { status, json } = await req(`/api/products/${productSlug}`);
    if (status === 200 && (json as { product?: { slug: string } })?.product?.slug)
      pass("GET /api/products/:slug");
    else fail("GET /api/products/:slug", JSON.stringify(json));
  }
  {
    const { status } = await req("/api/products/not-a-real-slug-xyz");
    if (status === 404) pass("GET product 404 for unknown slug");
    else fail("GET product 404", `status ${status}`);
  }

  // —— Validation / CSRF failures ——
  {
    const { status } = await req("/api/enquiries", {
      method: "POST",
      body: JSON.stringify({ name: "A", phone: "123", items: [] }),
    });
    if (status === 403) pass("POST /api/enquiries rejects missing CSRF");
    else fail("POST enquiry CSRF", `status ${status}`);
  }
  {
    const csrf = await getCsrf();
    const { status, json } = await csrfPost(
      "/api/enquiries",
      { name: "A", phone: "123", items: [] },
      csrf
    );
    if (
      status === 400 &&
      (json as { error?: { code?: string } })?.error?.code === "VALIDATION_ERROR"
    )
      pass("POST /api/enquiries rejects invalid payload (with CSRF)");
    else
      fail(
        "POST enquiry validation",
        `status ${status} ${JSON.stringify(json)}`
      );
  }
  {
    const { status, json } = await req("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ user: "x", password: "short" }),
    });
    if (status === 400)
      pass("POST /api/admin/login rejects short password");
    else fail("login validation", `status ${status} ${JSON.stringify(json)}`);
  }
  {
    const { status } = await req("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        user: "admin@sparknova.in",
        password: "WrongPassword1!",
      }),
    });
    if (status === 401) pass("POST /api/admin/login wrong password → 401");
    else fail("login wrong password", `status ${status}`);
  }

  // —— Enquiry happy path (OTP + CSRF) ——
  let enquiryNumber = "";
  if (productId) {
    try {
      const { csrf, challengeId, otp, email } = await sendOtp(
        TEST_PHONE_10,
        "ENQUIRY",
        "test-customer@example.com"
      );
      const { status, json } = await csrfPost(
        "/api/enquiries",
        {
          name: "Test Customer",
          phone: TEST_PHONE_10,
          email,
          whatsapp: TEST_PHONE_10,
          city: "Madurai",
          area: "Keerathurai",
          pincode: "625001",
          language: "en",
          preferredContact: "WHATSAPP",
          clientRequestId: randomUUID(),
          items: [{ productId, quantity: 2 }],
          otpChallengeId: challengeId,
          otp,
        },
        csrf
      );
      const data = json as {
        enquiryNumber?: string;
        whatsappUrl?: string;
        error?: unknown;
      };
      if (status === 201 && data.enquiryNumber) {
        enquiryNumber = data.enquiryNumber;
        pass("POST /api/enquiries success", enquiryNumber);
        if (data.whatsappUrl?.includes("wa.me") || !data.whatsappUrl)
          pass("Enquiry returns WhatsApp URL (or shop WA unset)");
        else fail("Enquiry WhatsApp URL", data.whatsappUrl);
      } else fail("POST /api/enquiries success", JSON.stringify(json));
    } catch (e) {
      fail("POST /api/enquiries success", String(e));
    }
  }

  // Idempotent enquiry reuse
  if (productId) {
    try {
      const idemp = randomUUID();
      const { csrf, challengeId, otp, email } = await sendOtp(
        "9876501234",
        "ENQUIRY",
        "idem-customer@example.com"
      );
      const body = {
        name: "Idem Customer",
        phone: "9876501234",
        email,
        whatsapp: "9876501234",
        city: "Chennai",
        area: "T Nagar",
        pincode: "600017",
        language: "en" as const,
        preferredContact: "WHATSAPP" as const,
        clientRequestId: idemp,
        items: [{ productId, quantity: 1 }],
        otpChallengeId: challengeId,
        otp,
      };
      const first = await csrfPost("/api/enquiries", body, csrf);
      // Double-submit with same clientRequestId should reuse without new OTP
      const second = await csrfPost("/api/enquiries", body, csrf);
      const n1 = (first.json as { enquiryNumber?: string }).enquiryNumber;
      const n2 = (second.json as { enquiryNumber?: string; reused?: boolean })
        .enquiryNumber;
      const reused = (second.json as { reused?: boolean }).reused;
      if (first.status === 201 && second.status === 200 && n1 === n2 && reused)
        pass("Enquiry idempotency reuses same number", n1);
      else if (first.status === 201 && n1 === n2)
        pass("Enquiry idempotency same number", n1);
      else
        fail(
          "Enquiry idempotency",
          `${first.status}/${second.status} ${JSON.stringify(second.json)}`
        );
    } catch (e) {
      fail("Enquiry idempotency", String(e));
    }
  }

  // —— Track / loyalty negative ——
  {
    const { status } = await csrfPost("/api/order-tracking", {
      orderNumber: "ORD-2026-9999",
      phone: TEST_PHONE_10,
    });
    if (status === 404) pass("Track unknown order → 404");
    else fail("Track unknown", `status ${status}`);
  }
  {
    const { status, json } = await csrfPost("/api/order-tracking", {
      orderNumber: "bad",
      phone: "123",
    });
    if (status === 400) pass("Track invalid payload → 400");
    else fail("Track validation", `status ${status} ${JSON.stringify(json)}`);
  }
  {
    const { status } = await csrfPost("/api/loyalty/check", {
      phone: TEST_PHONE_10,
      email: "test-customer@example.com",
      otpChallengeId: "not-a-real-challenge",
      otp: "000000",
    });
    if (status === 404) pass("Loyalty wrong OTP → 404 (no enum leak)");
    else fail("Loyalty wrong OTP", `status ${status}`);
  }

  // —— Admin login ——
  let cookie = "";
  {
    const { status, json, setCookie } = await req("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        user: "admin@sparknova.in",
        password: "Admin@12345",
      }),
    });
    cookie = cookieFrom(setCookie);
    if (status === 200 && cookie && (json as { user?: { role?: string } })?.user?.role === "ADMIN")
      pass("Admin login success", "role ADMIN");
    else fail("Admin login", `status ${status} cookie=${!!cookie} ${JSON.stringify(json)}`);
  }

  // Admin me
  {
    const { status, json } = await req("/api/admin/me", { cookie });
    if (status === 200 && (json as { user?: { email?: string } })?.user?.email)
      pass("GET /api/admin/me", (json as { user: { email: string } }).user.email);
    else fail("GET /api/admin/me", `status ${status}`);
  }

  // Dashboard requires admin
  {
    const { status, json } = await req("/api/admin/dashboard", { cookie });
    if (status === 200 && (json as { metrics?: unknown })?.metrics)
      pass("GET /api/admin/dashboard");
    else fail("dashboard", `status ${status} ${JSON.stringify(json)}`);
  }

  // Unauthenticated admin API
  {
    const { status } = await req("/api/admin/dashboard");
    if (status === 401) pass("Dashboard without cookie → 401");
    else fail("Dashboard unauth", `status ${status}`);
  }

  // Products admin
  {
    const { status, json } = await req("/api/admin/products", { cookie });
    if (status === 200 && Array.isArray((json as { products?: unknown[] }).products))
      pass("GET /api/admin/products");
    else fail("admin products", `status ${status}`);
  }

  // Enquiries list
  let enquiryId = "";
  {
    const { status, json } = await req("/api/admin/enquiries", { cookie });
    const list = (json as { enquiries?: { id: string; number: string }[] })
      ?.enquiries;
    if (status === 200 && Array.isArray(list)) {
      pass("GET /api/admin/enquiries", `${list.length} items`);
      const found = list.find((e) => e.number === enquiryNumber) || list[0];
      enquiryId = found?.id || "";
    } else fail("admin enquiries", `status ${status}`);
  }

  // Convert enquiry → order
  let orderNumber = "";
  let orderId = "";
  if (enquiryId) {
    const { status, json } = await req(
      `/api/admin/enquiries/${enquiryId}/convert-order`,
      { method: "POST", cookie }
    );
    const order = (json as { order?: { id: string; number: string } }).order;
    if ((status === 201 || status === 200) && order?.number) {
      orderNumber = order.number;
      orderId = order.id;
      pass("Convert enquiry → order", orderNumber);
    } else fail("convert enquiry", `status ${status} ${JSON.stringify(json)}`);
  }

  // Order status update valid transition
  if (orderId) {
    const { status, json } = await req("/api/admin/orders", {
      method: "PUT",
      cookie,
      body: JSON.stringify({
        id: orderId,
        status: "PACKING",
        customerMessage: "Packing started",
      }),
    });
    if (status === 200) pass("Order status ORDER_CONFIRMED → PACKING");
    else fail("order status valid", `status ${status} ${JSON.stringify(json)}`);

    // Admin may set any status and notify (no strict transition lock)
    const jump = await req("/api/admin/orders", {
      method: "PUT",
      cookie,
      body: JSON.stringify({ id: orderId, status: "DELIVERED" }),
    });
    if (jump.status === 200 && (jump.json as { whatsappUrl?: string }).whatsappUrl)
      pass("Order allows any status + WhatsApp");
    else fail("order any status", `status ${jump.status}`);
  }

  // Track order success — phone stored normalized with 91
  if (orderNumber) {
    const { status, json } = await csrfPost("/api/order-tracking", {
      orderNumber,
      phone: TEST_PHONE_E164,
    });
    if (status === 200) pass("Track order after convert", orderNumber);
    else
      fail(
        "Track order after convert",
        `status ${status} ${JSON.stringify(json)}`
      );
  }

  // Billing
  let invoiceToken = "";
  let invoiceNumber = "";
  if (productId) {
    const idemp = randomUUID();
    const { status, json } = await req("/api/admin/invoices", {
      method: "POST",
      cookie,
      body: JSON.stringify({
        customerName: "Bill Test",
        customerPhone: "9876512345",
        paymentMethod: "UPI",
        discountType: "NONE",
        discountValue: 0,
        loyaltyRedeem: 0,
        paidAmount: 5000,
        idempotencyKey: idemp,
        items: [{ productId, quantity: 1 }],
      }),
    });
    const inv = (json as { invoice?: { number: string; publicToken: string; grandTotal: number } })
      .invoice;
    if (status === 201 && inv?.number) {
      invoiceNumber = inv.number;
      invoiceToken = inv.publicToken;
      pass("POST /api/admin/invoices", `${inv.number} ₹${inv.grandTotal}`);
    } else fail("billing create", `status ${status} ${JSON.stringify(json)}`);

    // Idempotency
    const again = await req("/api/admin/invoices", {
      method: "POST",
      cookie,
      body: JSON.stringify({
        customerName: "Bill Test",
        customerPhone: "9876512345",
        paymentMethod: "UPI",
        discountType: "NONE",
        discountValue: 0,
        loyaltyRedeem: 0,
        paidAmount: 5000,
        idempotencyKey: idemp,
        items: [{ productId, quantity: 1 }],
      }),
    });
    const reused = (again.json as { reused?: boolean; invoice?: { number: string } })
      .reused;
    const n2 = (again.json as { invoice?: { number: string } }).invoice?.number;
    if (again.status === 200 && reused && n2 === invoiceNumber)
      pass("Billing idempotency");
    else if (n2 === invoiceNumber) pass("Billing idempotency same invoice");
    else fail("billing idempotency", JSON.stringify(again.json));

    // Oversell
    const oversell = await req("/api/admin/invoices", {
      method: "POST",
      cookie,
      body: JSON.stringify({
        paymentMethod: "CASH",
        discountType: "NONE",
        discountValue: 0,
        loyaltyRedeem: 0,
        paidAmount: 1,
        idempotencyKey: randomUUID(),
        items: [{ productId, quantity: 999999 }],
      }),
    });
    if (oversell.status === 400)
      pass("Billing rejects oversell");
    else fail("billing oversell", `status ${oversell.status}`);
  }

  // Public invoice
  if (invoiceToken) {
    const { status, json } = await req(
      `/api/public/invoices/${invoiceToken}`
    );
    const inv = (json as { invoice?: { customerPhoneMasked?: string } }).invoice;
    if (
      status === 200 &&
      inv?.customerPhoneMasked &&
      inv.customerPhoneMasked.includes("****")
    )
      pass("Public invoice masks phone", inv.customerPhoneMasked);
    else fail("public invoice", `status ${status} ${JSON.stringify(json)}`);
  }
  {
    const { status } = await req("/api/public/invoices/notarealtoken");
    if (status === 404) pass("Public invoice unknown token → 404");
    else fail("public invoice 404", `status ${status}`);
  }

  // Stock adjust
  if (productId) {
    const { status, json } = await req("/api/admin/stock/adjust", {
      method: "POST",
      cookie,
      body: JSON.stringify({
        productId,
        delta: 1,
        note: "Smoke test restock",
      }),
    });
    if (status === 200) pass("Stock adjust +1");
    else fail("stock adjust", `status ${status} ${JSON.stringify(json)}`);

    const neg = await req("/api/admin/stock/adjust", {
      method: "POST",
      cookie,
      body: JSON.stringify({
        productId,
        delta: -999999,
        note: "Should fail",
      }),
    });
    if (neg.status === 400) pass("Stock adjust blocks negative stock");
    else fail("stock negative", `status ${neg.status}`);
  }

  // Cashier cannot access dashboard (ADMIN only)
  {
    const login = await req("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        user: "cashier@sparknova.in",
        password: "Cashier@12345",
      }),
    });
    const cCookie = cookieFrom(login.setCookie);
    if (login.status === 200) pass("Cashier login");
    else fail("Cashier login", `status ${login.status}`);

    const dash = await req("/api/admin/dashboard", { cookie: cCookie });
    if (dash.status === 401 || dash.status === 403)
      pass("Cashier blocked from dashboard");
    else fail("Cashier dashboard RBAC", `status ${dash.status}`);

    const bill = await req("/api/admin/invoices", { cookie: cCookie });
    if (bill.status === 200) pass("Cashier can list invoices");
    else fail("Cashier invoices", `status ${bill.status}`);
  }

  // —— Extended admin CRUD ——
  let createdCategoryId = "";
  let createdProductId = "";
  let createdOfferId = "";
  {
    const slug = `test-cat-${Date.now().toString(36)}`;
    const { status, json } = await req("/api/admin/categories", {
      method: "POST",
      cookie,
      body: JSON.stringify({
        nameEn: "Test Category",
        slug,
        description: "Smoke test category",
        sortOrder: 99,
        isActive: true,
      }),
    });
    const cat = (json as { category?: { id: string } }).category;
    if (status === 201 && cat?.id) {
      createdCategoryId = cat.id;
      pass("POST /api/admin/categories", cat.id);
    } else fail("create category", `status ${status} ${JSON.stringify(json)}`);
  }

  if (createdCategoryId) {
    const code = `TST-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const slug = `smoke-product-${Date.now().toString(36)}`;
    const { status, json } = await req("/api/admin/products", {
      method: "POST",
      cookie,
      body: JSON.stringify({
        nameEn: "Smoke Test Sparkler",
        code,
        slug,
        categoryId: createdCategoryId,
        originalPrice: 200,
        offerPrice: 150,
        stock: 25,
        minStock: 5,
        isActive: true,
        isFeatured: false,
        isBestSeller: false,
        isBrandedSale: false,
        showVideoOnCard: true,
        showVideoOnDetails: true,
      }),
    });
    const product = (json as { product?: { id: string } }).product;
    if (status === 201 && product?.id) {
      createdProductId = product.id;
      pass("POST /api/admin/products", product.id);
    } else fail("create product", `status ${status} ${JSON.stringify(json)}`);

    // Validation: offer > original
    const bad = await req("/api/admin/products", {
      method: "POST",
      cookie,
      body: JSON.stringify({
        nameEn: "Bad Price",
        code: `BAD-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        slug: `bad-price-${Date.now().toString(36)}`,
        categoryId: createdCategoryId,
        originalPrice: 100,
        offerPrice: 200,
        stock: 1,
        isActive: true,
        isFeatured: false,
        isBestSeller: false,
        isBrandedSale: false,
      }),
    });
    if (bad.status === 400) pass("Product rejects offer > original");
    else fail("product price validation", `status ${bad.status}`);
  }

  if (createdProductId) {
    const get = await req(`/api/admin/products/${createdProductId}`, {
      cookie,
    });
    const product = (get.json as {
      product?: { id: string; code: string; slug: string };
    }).product;
    if (get.status === 200 && product?.id) pass("GET /api/admin/products/:id");
    else fail("get product by id", `status ${get.status}`);

    if (product) {
      const upd = await req("/api/admin/products", {
        method: "PUT",
        cookie,
        body: JSON.stringify({
          id: createdProductId,
          nameEn: "Smoke Test Sparkler Updated",
          code: product.code,
          slug: product.slug,
          categoryId: createdCategoryId,
          originalPrice: 220,
          offerPrice: 160,
          stock: 30,
          minStock: 5,
          isActive: true,
          isFeatured: true,
          isBestSeller: false,
          isBrandedSale: false,
          showVideoOnCard: true,
          showVideoOnDetails: true,
        }),
      });
      if (upd.status === 200) pass("PUT /api/admin/products");
      else
        fail(
          "update product",
          `status ${upd.status} ${JSON.stringify(upd.json)}`
        );
    }
  }

  {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 3);
    const { status, json } = await req("/api/admin/offers", {
      method: "POST",
      cookie,
      body: JSON.stringify({
        title: "Smoke Festival Offer",
        type: "FESTIVAL",
        discountLabel: "10% OFF",
        percentOff: 10,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        isActive: true,
      }),
    });
    const offer = (json as { offer?: { id: string } }).offer;
    if (status === 201 && offer?.id) {
      createdOfferId = offer.id;
      pass("POST /api/admin/offers", offer.id);
    } else fail("create offer", `status ${status} ${JSON.stringify(json)}`);
  }

  {
    const { status, json } = await req("/api/admin/settings", { cookie });
    if (status === 200 && (json as { shop?: unknown; loyalty?: unknown }).shop)
      pass("GET /api/admin/settings");
    else fail("get settings", `status ${status}`);

    const shop = (json as { shop: Record<string, unknown>; loyalty: Record<string, unknown> })
      .shop;
    const loyalty = (json as { shop: Record<string, unknown>; loyalty: Record<string, unknown> })
      .loyalty;
    const save = await req("/api/admin/settings", {
      method: "PUT",
      cookie,
      body: JSON.stringify({ shop, loyalty }),
    });
    if (save.status === 200) pass("PUT /api/admin/settings");
    else fail("save settings", `status ${save.status} ${JSON.stringify(save.json)}`);

    const bad = await req("/api/admin/settings", {
      method: "PUT",
      cookie,
      body: JSON.stringify({
        shop: { ...shop, whatsapp: "abc" },
        loyalty,
      }),
    });
    if (bad.status === 400) pass("Settings rejects bad WhatsApp");
    else fail("settings validation", `status ${bad.status}`);
  }

  {
    const { status, json } = await req("/api/admin/loyalty", { cookie });
    if (status === 200 && Array.isArray((json as { accounts?: unknown[] }).accounts))
      pass("GET /api/admin/loyalty");
    else fail("loyalty list", `status ${status}`);
  }

  {
    const { status, json } = await req("/api/admin/feedback", { cookie });
    if (status === 200 && Array.isArray((json as { feedback?: unknown[] }).feedback))
      pass("GET /api/admin/feedback");
    else fail("feedback list", `status ${status}`);
  }

  {
    const { status, json } = await req("/api/admin/reports/daily", { cookie });
    if (status === 200 && (json as { totals?: unknown }).totals)
      pass("GET /api/admin/reports/daily");
    else fail("daily report", `status ${status} ${JSON.stringify(json)}`);
  }

  if (invoiceNumber) {
    const list = await req("/api/admin/invoices", { cookie });
    const invs = (list.json as { invoices?: { id: string; number: string }[] })
      .invoices;
    const found = invs?.find((i) => i.number === invoiceNumber) || invs?.[0];
    if (found) {
      const detail = await req(`/api/admin/invoices/${found.id}`, { cookie });
      if (detail.status === 200)
        pass("GET /api/admin/invoices/:id");
      else fail("invoice detail", `status ${detail.status}`);
    }
  }

  // Admin pages load when authenticated
  for (const path of [
    "/admin/dashboard",
    "/admin/products",
    "/admin/products/new",
    "/admin/categories",
    "/admin/offers",
    "/admin/billing",
    "/admin/enquiries",
    "/admin/orders",
    "/admin/stock",
    "/admin/invoices",
    "/admin/loyalty",
    "/admin/feedback",
    "/admin/reports/daily",
    "/admin/settings",
  ]) {
    const res = await fetch(`${BASE}${path}`, {
      headers: { cookie },
      redirect: "manual",
    });
    if (res.status === 200) pass(`ADMIN PAGE ${path}`);
    else fail(`ADMIN PAGE ${path}`, `status ${res.status}`);
  }

  void createdOfferId;

  // Logout
  {
    const { status } = await req("/api/admin/logout", {
      method: "POST",
      cookie,
    });
    if (status === 200) pass("Admin logout");
    else fail("logout", `status ${status}`);
  }

  // —— Summary ——
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n—— Results: ${passed} passed, ${failed} failed ——\n`);
  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
