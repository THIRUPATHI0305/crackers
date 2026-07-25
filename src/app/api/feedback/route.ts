import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, fromZod } from "@/lib/api";
import { assertCsrf } from "@/lib/csrf";
import { feedbackSchema } from "@/lib/validation";
import { FEEDBACK_ALLOWED_STATUSES } from "@/lib/order-transitions";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (!csrf.ok) return apiError("FORBIDDEN", csrf.reason, 403);

  const ip = clientIp(req);
  if (!rateLimit(`feedback:${ip}`, 10, 60_000).ok) {
    return apiError("RATE_LIMITED", "Too many requests", 429);
  }

  try {
    const body = feedbackSchema.parse(await req.json());
    const order = await prisma.order.findFirst({
      where: { number: body.orderNumber },
      include: { customer: true, feedback: true },
    });
    if (!order || order.customer.phone !== body.phone) {
      return apiError("NOT_FOUND", "Order not found", 404);
    }
    if (!FEEDBACK_ALLOWED_STATUSES.has(order.status)) {
      return apiError("BUSINESS_RULE", "Feedback allowed after delivery only", 400);
    }
    if (order.feedback) {
      return apiError("CONFLICT", "Feedback already submitted", 409);
    }

    const feedback = await prisma.feedback.create({
      data: {
        orderId: order.id,
        rating: body.rating,
        productQuality: body.productQuality,
        packingQuality: body.packingQuality,
        staffService: body.staffService,
        deliveryExperience: body.deliveryExperience,
        comment: body.comment,
        allowPublicDisplay: body.allowPublicDisplay,
      },
    });

    return apiOk({ feedback }, 201);
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    return apiError("INTERNAL_ERROR", "Feedback failed", 500);
  }
}
