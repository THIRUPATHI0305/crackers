import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, fromZod } from "@/lib/api";
import { assertCsrf } from "@/lib/csrf";
import { trackOrderSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (!csrf.ok) return apiError("FORBIDDEN", csrf.reason, 403);

  const ip = clientIp(req);
  const rl = rateLimit(`track:${ip}`, 10, 60_000);
  if (!rl.ok) return apiError("RATE_LIMITED", "Too many requests", 429);

  try {
    const body = trackOrderSchema.parse(await req.json());
    const order = await prisma.order.findFirst({
      where: { number: body.orderNumber },
      include: {
        customer: true,
        history: { orderBy: { createdAt: "asc" } },
        proofs: true,
      },
    });

    if (!order || order.customer.phone !== body.phone) {
      return apiError("NOT_FOUND", "Order not found for this mobile number", 404);
    }

    return apiOk({
      order: {
        number: order.number,
        status: order.status,
        amount: order.amount,
        eta: order.eta,
        customerNote: order.customerNote,
        customerName: order.customer.name,
        date: order.createdAt,
        history: order.history,
        proofs: order.proofs.map((p) => ({ id: p.id, url: p.url })),
        deliveredAt: order.deliveredAt,
      },
    });
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    return apiError("INTERNAL_ERROR", "Tracking failed", 500);
  }
}
