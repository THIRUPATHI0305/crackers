import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, fromZod } from "@/lib/api";
import { assertCsrf } from "@/lib/csrf";
import { consumeOtpChallenge } from "@/lib/otp";
import { assertPhoneEmailBinding } from "@/lib/phone-email";
import { contactSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (!csrf.ok) return apiError("FORBIDDEN", csrf.reason, 403);

  const ip = clientIp(req);
  if (!rateLimit(`contact:${ip}`, 10, 60_000).ok) {
    return apiError("RATE_LIMITED", "Too many requests", 429);
  }

  try {
    const body = contactSchema.parse(await req.json());
    if (!rateLimit(`contact-phone:${body.phone}`, 5, 60 * 60_000).ok) {
      return apiError("RATE_LIMITED", "Too many messages for this number", 429);
    }

    const binding = await assertPhoneEmailBinding(body.phone, body.email);
    if (!binding.ok) {
      return apiError("BUSINESS_RULE", binding.message, 400);
    }

    const otp = await consumeOtpChallenge({
      challengeId: body.otpChallengeId,
      phone: body.phone,
      email: body.email,
      purpose: "CONTACT",
      otp: body.otp,
    });
    if (!otp.ok) {
      return apiError("VALIDATION_ERROR", otp.message, 400);
    }

    await prisma.customer.upsert({
      where: { phone: body.phone },
      update: {
        name: body.name,
        email: body.email,
      },
      create: {
        name: body.name,
        phone: body.phone,
        email: body.email,
      },
    });

    const row = await prisma.contactMessage.create({
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email,
        message: body.message,
      },
    });

    return apiOk({ id: row.id, ok: true }, 201);
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    console.error(e);
    return apiError("INTERNAL_ERROR", "Could not send message", 500);
  }
}
