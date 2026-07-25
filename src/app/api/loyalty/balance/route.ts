import { ZodError } from "zod";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, fromZod } from "@/lib/api";
import { assertCsrf } from "@/lib/csrf";
import { phoneSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getLoyaltyPublicSettings } from "@/lib/shop-settings";

const bodySchema = z.object({ phone: phoneSchema });

/** Soft balance lookup for enquiry redeem UI (rate-limited). */
export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (!csrf.ok) return apiError("FORBIDDEN", csrf.reason, 403);

  const ip = clientIp(req);
  const rl = rateLimit(`loyalty-balance:${ip}`, 20, 60_000);
  if (!rl.ok) return apiError("RATE_LIMITED", "Too many requests", 429);

  try {
    const body = bodySchema.parse(await req.json());
    const loyalty = await getLoyaltyPublicSettings();
    if (!loyalty.enabled) {
      return apiOk({
        availablePoints: 0,
        enabled: false,
        maxRedeemable: 0,
      });
    }

    const account = await prisma.loyaltyAccount.findUnique({
      where: { phone: body.phone },
      select: { availablePoints: true },
    });

    return apiOk({
      availablePoints: account?.availablePoints ?? 0,
      enabled: true,
      maxDiscountPercent: loyalty.maxDiscountPercent,
      maxLoyaltyDiscountAmount: loyalty.maxLoyaltyDiscountAmount,
      minRedemptionPoints: loyalty.minRedemptionPoints,
      pointsPerHundred: loyalty.pointsPerHundred,
    });
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    return apiError("INTERNAL_ERROR", "Could not load loyalty", 500);
  }
}
