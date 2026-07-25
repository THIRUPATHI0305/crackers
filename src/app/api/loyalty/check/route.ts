import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, fromZod } from "@/lib/api";
import { assertCsrf } from "@/lib/csrf";
import { consumeOtpChallenge } from "@/lib/otp";
import { loyaltyCheckSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (!csrf.ok) return apiError("FORBIDDEN", csrf.reason, 403);

  const ip = clientIp(req);
  const rl = rateLimit(`loyalty:${ip}`, 10, 60_000);
  if (!rl.ok) return apiError("RATE_LIMITED", "Too many requests", 429);

  try {
    const body = loyaltyCheckSchema.parse(await req.json());

    if (body.invoiceNumber) {
      const inv = await prisma.invoice.findFirst({
        where: {
          number: body.invoiceNumber,
          customerPhone: body.phone,
          cancelledAt: null,
        },
      });
      if (!inv) {
        return apiError("NOT_FOUND", "Unable to verify loyalty details", 404);
      }
    } else {
      const otp = await consumeOtpChallenge({
        challengeId: body.otpChallengeId!,
        phone: body.phone,
        email: body.email!,
        purpose: "LOYALTY",
        otp: body.otp!,
      });
      if (!otp.ok) {
        return apiError("NOT_FOUND", "Unable to verify loyalty details", 404);
      }
    }

    const account = await prisma.loyaltyAccount.findUnique({
      where: { phone: body.phone },
      include: { customer: true },
    });
    if (!account) {
      return apiError("NOT_FOUND", "Unable to verify loyalty details", 404);
    }

    return apiOk({
      name: account.customer.name,
      availablePoints: account.availablePoints,
      earnedPoints: account.earnedPoints,
      redeemedPoints: account.redeemedPoints,
      expiresAt: account.expiresAt,
      rewardMessage: `You can redeem ₹${account.availablePoints} off on your next eligible bill.`,
    });
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    return apiError("INTERNAL_ERROR", "Loyalty check failed", 500);
  }
}
