import { ZodError } from "zod";
import { requireSession, writeAudit } from "@/lib/auth";
import { apiError, apiOk, fromZod } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { loyaltyAdjustSchema } from "@/lib/validation";

export async function GET(req: Request) {
  const phoneRaw = new URL(req.url).searchParams.get("phone");

  if (phoneRaw) {
    const { error } = await requireSession(["ADMIN", "CASHIER"]);
    if (error)
      return apiError(error, "Forbidden", error === "FORBIDDEN" ? 403 : 401);

    const digits = phoneRaw.replace(/\D/g, "");
    const phone = digits.length === 10 ? `91${digits}` : digits;
    const account = await prisma.loyaltyAccount.findFirst({
      where: {
        OR: [{ phone }, { phone: { endsWith: digits.slice(-10) } }],
      },
      include: { customer: true },
    });
    return apiOk({
      account: account
        ? {
            id: account.id,
            phone: account.phone,
            availablePoints: account.availablePoints,
            customerName: account.customer.name,
          }
        : null,
    });
  }

  const { error } = await requireSession(["ADMIN"]);
  if (error)
    return apiError(error, "Forbidden", error === "FORBIDDEN" ? 403 : 401);

  const accounts = await prisma.loyaltyAccount.findMany({
    include: {
      customer: true,
      transactions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { availablePoints: "desc" },
  });
  return apiOk({ accounts });
}

export async function POST(req: Request) {
  const auth = await requireSession(["ADMIN"]);
  if (auth.error || !auth.user) {
    return apiError(auth.error || "UNAUTHORIZED", "Forbidden", 401);
  }

  try {
    const body = loyaltyAdjustSchema.parse(await req.json());
    const account = await prisma.loyaltyAccount.findUnique({
      where: { id: body.accountId },
    });
    if (!account) return apiError("NOT_FOUND", "Loyalty account not found", 404);

    const next = account.availablePoints + body.delta;
    if (next < 0) {
      return apiError("BUSINESS_RULE", "Insufficient loyalty points", 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.loyaltyAccount.update({
        where: { id: body.accountId },
        data: {
          availablePoints: next,
          earnedPoints:
            body.delta > 0
              ? account.earnedPoints + body.delta
              : account.earnedPoints,
          redeemedPoints:
            body.delta < 0
              ? account.redeemedPoints + Math.abs(body.delta)
              : account.redeemedPoints,
        },
        include: { customer: true },
      });
      await tx.loyaltyTransaction.create({
        data: {
          accountId: body.accountId,
          type: body.delta > 0 ? "ADJUST_CREDIT" : "ADJUST_DEBIT",
          points: body.delta,
          note: body.note,
        },
      });
      return row;
    });

    await writeAudit(auth.user.id, "LOYALTY_ADJUST", "LoyaltyAccount", updated.id, {
      delta: body.delta,
    });
    return apiOk({ account: updated });
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    return apiError("INTERNAL_ERROR", "Could not adjust loyalty", 500);
  }
}
