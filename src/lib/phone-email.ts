import { prisma } from "@/lib/prisma";

type CustomerRow = { phone: string; email: string | null };

export type CustomerProfile = {
  phone: string;
  email: string | null;
  name: string | null;
  whatsapp: string | null;
  city: string | null;
  area: string | null;
  pincode: string | null;
};

/**
 * Returning customer profile for form autofill (by mobile).
 */
export async function lookupCustomerByPhone(
  phone: string
): Promise<CustomerProfile | null> {
  try {
    const row = await prisma.customer.findUnique({
      where: { phone },
      select: {
        phone: true,
        email: true,
        name: true,
        whatsapp: true,
        city: true,
        area: true,
        pincode: true,
      },
    });
    return row;
  } catch (e) {
    console.warn("[phone-email] profile lookup skipped:", e);
    return null;
  }
}

export type BindingResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      registeredEmail?: string;
      registeredPhone?: string;
    };

/**
 * One mobile number ↔ one email.
 * First-time customers (no row / empty email) are allowed to bind.
 * On mismatch, returns the registered email/phone so the UI can autofill.
 */
export async function assertPhoneEmailBinding(
  phone: string,
  email: string
): Promise<BindingResult> {
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
        registeredPhone: byEmail.phone,
      };
    }
    return { ok: true };
  }

  if (byPhone?.email && byPhone.email.toLowerCase() !== normalized) {
    return {
      ok: false,
      message:
        "This mobile is already registered. We’ve filled your saved email — continue with OTP.",
      registeredEmail: byPhone.email,
    };
  }

  if (byEmail && byEmail.phone !== phone) {
    return {
      ok: false,
      message:
        "This email is already linked to another mobile number. Use the registered mobile.",
      registeredPhone: byEmail.phone,
    };
  }

  return { ok: true };
}
