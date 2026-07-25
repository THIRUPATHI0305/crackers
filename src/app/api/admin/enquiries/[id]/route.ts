import { requireSession } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession(["ADMIN"]);
  if (error) return apiError(error, "Forbidden", 401);

  const { id } = await ctx.params;
  const enquiry = await prisma.enquiry.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { product: { include: { category: true } } } },
      order: { select: { id: true, number: true } },
      invoice: {
        select: {
          id: true,
          number: true,
          publicToken: true,
          grandTotal: true,
        },
      },
    },
  });
  if (!enquiry) return apiError("NOT_FOUND", "Enquiry not found", 404);
  return apiOk({ enquiry });
}
