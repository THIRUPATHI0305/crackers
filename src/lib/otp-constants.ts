/** Shared OTP timing — used by API + storefront UI. */
export const OTP_TTL_SECONDS = 120; // OTP valid for 2 minutes
export const OTP_RESEND_SECONDS = 120; // Resend button after 2 minutes
export const OTP_TTL_MS = OTP_TTL_SECONDS * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export function formatOtpCountdown(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
