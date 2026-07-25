import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, fromZod } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import {
  getSession,
  verifyPassword,
  writeAudit,
} from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`login:${ip}`, 5, 15 * 60_000);
  if (!rl.ok) return apiError("RATE_LIMITED", "Too many login attempts", 429);

  try {
    const body = loginSchema.parse(await req.json());
    const user = await prisma.adminUser.findFirst({
      where: {
        OR: [{ email: body.user }, { username: body.user }],
      },
    });

    const fail = async () => {
      if (user) {
        const failedLogins = user.failedLogins + 1;
        await prisma.adminUser.update({
          where: { id: user.id },
          data: {
            failedLogins,
            lockedUntil:
              failedLogins >= 5
                ? new Date(Date.now() + 15 * 60_000)
                : user.lockedUntil,
          },
        });
        await writeAudit(user.id, "LOGIN_FAIL", "AdminUser", user.id, { ip });
      }
      return apiError("UNAUTHORIZED", "Invalid credentials", 401);
    };

    if (!user || !user.isActive) return fail();
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return apiError("FORBIDDEN", "Account temporarily locked", 403);
    }

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) return fail();

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    session.role = user.role as "ADMIN" | "CASHIER";
    session.isLoggedIn = true;
    await session.save();

    await writeAudit(user.id, "LOGIN_SUCCESS", "AdminUser", user.id, { ip });

    return apiOk({
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    console.error(e);
    return apiError("INTERNAL_ERROR", "Login failed", 500);
  }
}
