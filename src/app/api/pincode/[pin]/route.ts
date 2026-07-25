import { apiError, apiOk } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";

type PostalOffice = {
  Name?: string;
  District?: string;
  Block?: string;
  State?: string;
  Pincode?: string;
};

type PostalResponse = {
  Status?: string;
  Message?: string;
  PostOffice?: PostalOffice[] | null;
};

function isTamilNadu(state: string) {
  const s = state.toLowerCase().replace(/\s+/g, "");
  return s === "tamilnadu" || s === "tn";
}

/**
 * Lookup Indian pincode → city + area options.
 * Only Tamil Nadu pincodes are accepted for storefront delivery.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ pin: string }> }
) {
  const ip = clientIp(_req);
  if (!rateLimit(`pincode:${ip}`, 30, 60_000).ok) {
    return apiError("RATE_LIMITED", "Too many pincode lookups", 429);
  }

  const { pin } = await ctx.params;
  if (!/^\d{6}$/.test(pin)) {
    return apiError("VALIDATION_ERROR", "Enter a valid 6-digit pincode", 400);
  }

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return apiError("INTERNAL_ERROR", "Pincode lookup unavailable", 502);
    }

    const data = (await res.json()) as PostalResponse[];
    const row = data?.[0];
    const offices = row?.PostOffice;
    if (row?.Status !== "Success" || !offices?.length) {
      return apiError("NOT_FOUND", "No address found for this pincode", 404);
    }

    const state = (offices[0].State || "").trim();
    if (!isTamilNadu(state)) {
      return apiError(
        "BUSINESS_RULE",
        "We deliver only within Tamil Nadu. Enter a Tamil Nadu pincode.",
        400
      );
    }

    const city = (offices[0].District || "").trim();
    const areas = [
      ...new Set(
        offices
          .map((o) => (o.Name || "").trim())
          .filter((n) => n.length > 0)
      ),
    ];

    return apiOk({
      pincode: pin,
      city,
      state: "Tamil Nadu",
      areas,
      area: areas[0] || "",
      address: [areas[0], city, "Tamil Nadu", pin].filter(Boolean).join(", "),
    });
  } catch (e) {
    console.error(e);
    return apiError("INTERNAL_ERROR", "Pincode lookup failed", 500);
  }
}
