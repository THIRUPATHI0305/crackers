import { prisma } from "@/lib/prisma";

type CustomerRow = { phone: string; email: string | null };

/**
 * One mobile number ↔ one email.
 * First-time customers (no row / empty email) are allowed to bind.
 */
export async function assertPhoneEmailBinding(
  phone: string,
  email: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const normalized = email.trim().toLowerCase();

  let rows: CustomerRow[] = [];
  try {
    rows = await prisma.customer.findMany({
      where: {
        OR: [{ phone }, { email: normalized }],
      },
      select: { phone: true, email: true },
    });
  } catch (e) {
    console.warn("[phone-email] lookup skipped:", e);
    return { ok: true };
  }

  if (rows.length === 0) {
    return { ok: true };
  }

  const byPhone = rows.find((r) => r.phone === phone);
  const byEmail = rows.find(
    (r) => (r.email || "").toLowerCase() === normalized
  );

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
