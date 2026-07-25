import { prisma } from "@/lib/prisma";

type CustomerRow = { phone: string; email: string | null };

/**
 * One mobile number ↔ one email.
 * Uses raw SQL so it works even if a stale Prisma client is missing the `email` field.
 * First-time customers (no row / empty email) are allowed to bind.
 */
export async function assertPhoneEmailBinding(
  phone: string,
  email: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const normalized = email.trim().toLowerCase();

  let rows: CustomerRow[] = [];
  try {
    rows = await prisma.$queryRaw<CustomerRow[]>`
      SELECT phone, email
      FROM "Customer"
      WHERE phone = ${phone}
         OR lower(coalesce(email, '')) = ${normalized}
    `;
  } catch (e) {
    // Column missing or DB not migrated yet — allow first bind; upsert may still fail.
    console.warn("[phone-email] lookup skipped:", e);
    return { ok: true };
  }

  // No customer yet → first registration, OK
  if (rows.length === 0) {
    return { ok: true };
  }

  const byPhone = rows.find((r) => r.phone === phone);
  const byEmail = rows.find(
    (r) => (r.email || "").toLowerCase() === normalized
  );

  // Phone exists but email empty/null → allow binding this email
  if (byPhone && !(byPhone.email || "").trim()) {
    if (byEmail && byEmail.phone !== phone) {
      return {
        ok: false,
        message:
          "This email is already linked to another mobile number. Use the registered mobile.",
      };
    }
    return { ok: true };
  }

  if (byPhone?.email && byPhone.email.toLowerCase() !== normalized) {
    return {
      ok: false,
      message:
        "This mobile number is already linked to another email. Use the registered email, or contact the shop.",
    };
  }

  if (byEmail && byEmail.phone !== phone) {
    return {
      ok: false,
      message:
        "This email is already linked to another mobile number. Use the registered mobile.",
    };
  }

  return { ok: true };
}
