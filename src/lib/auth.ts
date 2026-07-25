import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionData } from "@/lib/session";

export type { SessionData };
export { sessionOptions };

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function requireSession(roles?: Array<"ADMIN" | "CASHIER">) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId || !session.role) {
    return { session: null, error: "UNAUTHORIZED" as const };
  }
  if (roles && !roles.includes(session.role)) {
    return { session: null, error: "FORBIDDEN" as const };
  }
  const user = await prisma.adminUser.findUnique({
    where: { id: session.userId },
  });
  if (!user || !user.isActive) {
    return { session: null, error: "UNAUTHORIZED" as const };
  }
  return { session, user, error: null };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function writeAudit(
  adminId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  meta?: unknown
) {
  await prisma.auditLog.create({
    data: {
      adminId: adminId ?? undefined,
      action,
      entityType,
      entityId,
      meta: meta ? JSON.stringify(meta) : undefined,
    },
  });
}
