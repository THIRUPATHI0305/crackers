import { ZodError } from "zod";
import { apiError, apiOk, fromZod } from "@/lib/api";
import { assertCsrf } from "@/lib/csrf";
import { attachOtpProvider, createOtpChallenge, deliverOtp } from "@/lib/otp";
import { assertPhoneEmailBinding } from "@/lib/phone-email";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { OTP_RESEND_SECONDS } from "@/lib/otp-constants";
import { otpSendSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (!csrf.ok) return apiError("FORBIDDEN", csrf.reason, 403);

  const ip = clientIp(req);
  if (!rateLimit(`otp-send:${ip}`, 8, 60_000).ok) {
    return apiError("RATE_LIMITED", "Too many OTP requests", 429);
  }

  try {
    const body = otpSendSchema.parse(await req.json());
    if (!rateLimit(`otp-send-phone:${body.phone}`, 5, 60 * 60_000).ok) {
      return apiError("RATE_LIMITED", "OTP limit reached for this number", 429);
    }
    if (!rateLimit(`otp-send-email:${body.email}`, 5, 60 * 60_000).ok) {
      return apiError("RATE_LIMITED", "OTP limit reached for this email", 429);
    }

    const binding = await assertPhoneEmailBinding(body.phone, body.email);
    if (!binding.ok) {
      return apiError("BUSINESS_RULE", binding.message, 400, undefined, {
        registeredEmail: binding.registeredEmail,
        registeredPhone: binding.registeredPhone,
      });
    }

    const challenge = await createOtpChallenge({
      phone: body.phone,
      email: body.email,
      purpose: body.purpose,
      ip,
    });
    const delivery = await deliverOtp(
      body.phone,
      challenge.code,
      body.purpose,
      body.email
    );

    if (delivery.ok) {
      await attachOtpProvider(challenge.challengeId, {
        provider: delivery.channel,
        logId: delivery.logId,
      });
    }

    // Always expose local code when email/SMS did not deliver live
    // (includes Dev fallback after network errors). Never for AuthKey live OTP.
    const canDebug =
      delivery.channel !== "authkey" &&
      (delivery.channel === "dev" ||
        !delivery.ok ||
        delivery.networkError ||
        process.env.OTP_DEBUG === "1" ||
        process.env.NODE_ENV !== "production");

    return apiOk({
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt,
      expiresInSeconds: challenge.expiresInSeconds,
      resendAfterSeconds: OTP_RESEND_SECONDS,
      delivery: {
        ok: delivery.ok,
        channel: delivery.channel,
        message: delivery.message,
        networkError: Boolean(delivery.networkError),
      },
      ...(canDebug && challenge.code ? { debugCode: challenge.code } : {}),
    });
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    console.error(e);
    return apiError("INTERNAL_ERROR", "Could not send OTP", 500);
  }
}
