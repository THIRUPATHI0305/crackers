import type { SessionOptions } from "iron-session";

export type SessionData = {
  userId?: string;
  role?: "ADMIN" | "CASHIER";
  email?: string;
  isLoggedIn: boolean;
};

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ||
    "dev-only-change-me-to-32-chars-min!!",
  cookieName: process.env.SESSION_COOKIE_NAME || "sn_admin_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 12,
    path: "/",
  },
};
