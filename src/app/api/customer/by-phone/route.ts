import { ZodError } from "zod";
import { z } from "zod";
import { apiError, apiOk, fromZod } from "@/lib/api";
import { assertCsrf } from "@/lib/csrf";
import { lookupCustomerByPhone } from "@/lib/phone-email";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { phoneSchema } from "@/lib/validation";

const bodySchema = z.object({ phone: phoneSchema });

/** Autofill returning-customer fields from mobile number. */
export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (!csrf.ok) return apiError("FORBIDDEN", csrf.reason, 403);

  const ip = clientIp(req);
  if (!rateLimit(`customer-by-phone:${ip}`, 30, 60_000).ok) {
    return apiError("RATE_LIMITED", "Too many requests", 429);
  }

  try {
    const body = bodySchema.parse(await req.json());
    if (!rateLimit(`customer-by-phone-num:${body.phone}`, 20, 60 * 60_000).ok) {
      return apiError("RATE_LIMITED", "Too many lookups for this number", 429);
    }

    const profile = await lookupCustomerByPhone(body.phone);
    if (!profile) {
      return apiOk({ found: false as const });
    }

    return apiOk({
      found: true as const,
      phone: profile.phone,
      email: profile.email || "",
      name: profile.name || "",
      whatsapp: profile.whatsapp || "",
      city: profile.city || "",
      area: profile.area || "",
      pincode: profile.pincode || "",
      emailLocked: Boolean(profile.email?.trim()),
    });
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    console.error(e);
    return apiError("INTERNAL_ERROR", "Could not look up customer", 500);
  }
}
