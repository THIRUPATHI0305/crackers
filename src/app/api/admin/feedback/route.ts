import { requireSession } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error } = await requireSession(["ADMIN"]);
  if (error) return apiError(error, "Forbidden", error === "FORBIDDEN" ? 403 : 401);

  const feedback = await prisma.feedback.findMany({
    include: {
      order: {
        include: { customer: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return apiOk({ feedback });
}
