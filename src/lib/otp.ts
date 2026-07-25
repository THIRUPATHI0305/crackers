import { createHash, randomInt, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  OTP_TTL_SECONDS,
} from "@/lib/otp-constants";
import { verifyAuthkeyOtp } from "@/lib/otp-delivery";

export type OtpPurpose =
  | "ENQUIRY"
  | "LOYALTY"
  | "TRACK"
  | "FEEDBACK"
  | "CONTACT";

function hashOtp(code: string, phone: string, purpose: string, email?: string) {
  return createHash("sha256")
    .update(
      `${purpose}:${phone}:${(email || "").toLowerCase()}:${code}:${process.env.OTP_SECRET || process.env.SESSION_SECRET || "dev-otp"}`
    )
    .digest("hex");
}

function safeEqualHex(a: string, b: string) {
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function generateOtpCode() {
  return String(randomInt(100000, 999999));
}

export async function createOtpChallenge(opts: {
  phone: string;
  email: string;
  purpose: OtpPurpose;
  ip?: string;
}) {
  const email = opts.email.trim().toLowerCase();
  const code = generateOtpCode();
  const codeHash = hashOtp(code, opts.phone, opts.purpose, email);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.otpChallenge.updateMany({
    where: {
      phone: opts.phone,
      purpose: opts.purpose,
      consumedAt: null,
    },
    data: { consumedAt: new Date() },
  });

  const challenge = await prisma.otpChallenge.create({
    data: {
      phone: opts.phone,
      email,
      purpose: opts.purpose,
      codeHash,
      expiresAt,
      maxAttempts: OTP_MAX_ATTEMPTS,
      ip: opts.ip,
    },
  });

  const showDebug =
    process.env.NODE_ENV !== "production" || process.env.OTP_DEBUG === "1";

  return {
    challengeId: challenge.id,
    expiresAt,
    expiresInSeconds: OTP_TTL_SECONDS,
    debugCode: showDebug ? code : undefined,
    code,
  };
}

/** Attach provider metadata after OTP send. */
export async function attachOtpProvider(
  challengeId: string,
  opts: { provider: string; logId?: string }
) {
  await prisma.otpChallenge.update({
    where: { id: challengeId },
    data: {
      provider: opts.provider,
      providerLogId: opts.logId || null,
    },
  });
}

export async function consumeOtpChallenge(opts: {
  challengeId: string;
  phone: string;
  email: string;
  purpose: OtpPurpose;
  otp: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const email = opts.email.trim().toLowerCase();
  const row = await prisma.otpChallenge.findUnique({
    where: { id: opts.challengeId },
  });
  if (
    !row ||
    row.purpose !== opts.purpose ||
    row.phone !== opts.phone ||
    (row.email || "").toLowerCase() !== email
  ) {
    return { ok: false, message: "Invalid OTP. Request a new code." };
  }
  if (row.consumedAt) {
    return { ok: false, message: "OTP already used. Request a new code." };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      message: "OTP expired after 2 minutes. Tap Resend OTP.",
    };
  }
  if (row.attempts >= row.maxAttempts) {
    return {
      ok: false,
      message: "Too many wrong attempts. Tap Resend OTP.",
    };
  }

  let match = false;

  if (row.provider === "authkey" && row.providerLogId) {
    const remote = await verifyAuthkeyOtp(row.providerLogId, opts.otp.trim());
    if (!remote.ok) {
      await prisma.otpChallenge.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 } },
      });
      const left = row.maxAttempts - (row.attempts + 1);
      return {
        ok: false,
        message:
          left > 0
            ? `Incorrect OTP. ${left} attempt${left === 1 ? "" : "s"} left.`
            : "Too many wrong attempts. Tap Resend OTP.",
      };
    }
    match = true;
  } else {
    const expected = hashOtp(opts.otp, opts.phone, opts.purpose, email);
    match = safeEqualHex(expected, row.codeHash);
  }

  await prisma.otpChallenge.update({
    where: { id: row.id },
    data: {
      attempts: { increment: 1 },
      ...(match ? { consumedAt: new Date() } : {}),
    },
  });

  if (!match) {
    const left = row.maxAttempts - (row.attempts + 1);
    return {
      ok: false,
      message:
        left > 0
          ? `Incorrect OTP. ${left} attempt${left === 1 ? "" : "s"} left.`
          : "Too many wrong attempts. Tap Resend OTP.",
    };
  }
  return { ok: true };
}

export { deliverOtp } from "@/lib/otp-delivery";
export type { OtpDeliveryResult } from "@/lib/otp-delivery";
