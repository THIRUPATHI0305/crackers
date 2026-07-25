import { prisma } from "@/lib/prisma";
import { requireSession, writeAudit } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(["ADMIN"]);
  if (auth.error || !auth.user) return apiError(auth.error || "UNAUTHORIZED", "Forbidden", 401);

  const { id } = await ctx.params;
  const enquiry = await prisma.enquiry.findUnique({
    where: { id },
    include: { customer: true, items: true, order: true },
  });
  if (!enquiry) return apiError("NOT_FOUND", "Enquiry not found", 404);
  if (enquiry.order) {
    return apiOk({ order: enquiry.order, reused: true });
  }

  const year = new Date().getFullYear();
  const count = await prisma.order.count();
  const number = `ORD-${year}-${String(count + 1).padStart(4, "0")}`;

  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        number,
        enquiryId: enquiry.id,
        customerId: enquiry.customerId,
        status: "ORDER_CONFIRMED",
        amount: enquiry.estimatedAmount,
        customerNote: enquiry.note,
        items: {
          create: enquiry.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
        history: {
          create: [
            { status: "ENQUIRY_RECEIVED", message: "Converted from enquiry" },
            { status: "ORDER_CONFIRMED", message: "Order confirmed by admin" },
          ],
        },
      },
    });
    await tx.enquiry.update({
      where: { id: enquiry.id },
      data: { status: "CONVERTED" },
    });
    return o;
  });

  await writeAudit(auth.user.id, "ENQUIRY_CONVERT", "Order", order.id, {
    enquiry: enquiry.number,
  });

  return apiOk({ order }, 201);
}
