import { ZodError } from "zod";
import { requireSession, writeAudit } from "@/lib/auth";
import { apiError, apiOk, fromZod } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  awardEnquiryPaidPoints,
  enquiryAlreadyAwardedPoints,
  pointsForAmount,
} from "@/lib/enquiry-loyalty";
import { getLoyaltyPublicSettings } from "@/lib/shop-settings";
import { enquiryStatusSchema } from "@/lib/validation";
import { z } from "zod";

export async function GET(req: Request) {
  const { error } = await requireSession(["ADMIN"]);
  if (error) return apiError(error, "Forbidden", 401);

  try {
    const q = new URL(req.url).searchParams.get("q") || undefined;
    const enquiries = await prisma.enquiry.findMany({
      where: q
        ? {
            OR: [
              { number: { contains: q } },
              { customer: { phone: { contains: q.replace(/\D/g, "") } } },
              { customer: { name: { contains: q } } },
            ],
          }
        : undefined,
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
            customerName: true,
            customerPhone: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const loyalty = await getLoyaltyPublicSettings();
    const withPts = await Promise.all(
      enquiries.map(async (e) => {
        const awarded = await enquiryAlreadyAwardedPoints(e.number);
        const pendingPts =
          e.status === "PAID" || e.status === "BILL_SENT"
            ? awarded
            : pointsForAmount(e.estimatedAmount, loyalty.pointsPerHundred);
        return {
          ...e,
          loyaltyPointsAwarded: awarded,
          /** Pts for this amount if marked PAID (0 when not paid / zero amount) */
          loyaltyPointsForAmount:
            e.status === "PAID" || e.status === "BILL_SENT" || awarded > 0
              ? awarded || pendingPts
              : 0,
          loyaltyPointsIfPaid: pointsForAmount(
            e.estimatedAmount,
            loyalty.pointsPerHundred
          ),
        };
      })
    );

    return apiOk({ enquiries: withPts });
  } catch (e) {
    console.error(e);
    return apiError("INTERNAL_ERROR", "Failed to load enquiries", 500);
  }
}

const statusBody = z.object({
  id: z.string().min(1),
  status: enquiryStatusSchema,
  internalNote: z.string().max(500).optional(),
});

export async function PUT(req: Request) {
  const auth = await requireSession(["ADMIN"]);
  if (auth.error || !auth.user)
    return apiError(auth.error || "UNAUTHORIZED", "Forbidden", 401);

  try {
    const body = statusBody.parse(await req.json());
    const current = await prisma.enquiry.findUnique({
      where: { id: body.id },
      include: { customer: true, invoice: { select: { id: true } } },
    });
    if (!current) return apiError("NOT_FOUND", "Enquiry not found", 404);

    const enquiry = await prisma.enquiry.update({
      where: { id: body.id },
      data: { status: body.status, internalNote: body.internalNote },
      include: { customer: true, invoice: { select: { id: true } } },
    });

    let loyaltyAward: {
      awarded: number;
      alreadyAwarded: boolean;
      reason: string;
    } | null = null;

    if (body.status === "PAID" || body.status === "BILL_SENT") {
      loyaltyAward = await awardEnquiryPaidPoints({
        enquiryId: enquiry.id,
        enquiryNumber: enquiry.number,
        estimatedAmount: enquiry.estimatedAmount,
        customerId: enquiry.customerId,
        phone: enquiry.customer.phone,
      });
    }

    await writeAudit(auth.user.id, "ENQUIRY_STATUS", "Enquiry", enquiry.id, {
      status: body.status,
      loyaltyAward,
    });

    return apiOk({
      enquiry: {
        ...enquiry,
        status: enquiry.invoice && body.status === "BILL_SENT"
          ? "BILL_SENT"
          : enquiry.status,
      },
      loyaltyAward,
      message:
        (body.status === "PAID" || body.status === "BILL_SENT") &&
        loyaltyAward &&
        loyaltyAward.awarded > 0
          ? loyaltyAward.alreadyAwarded
            ? `Already credited +${loyaltyAward.awarded} pts for next bill`
            : `${body.status} · +${loyaltyAward.awarded} pts credited for next bill`
          : body.status === "PAID" || body.status === "BILL_SENT"
            ? `${body.status} · no points for this amount`
            : `Status → ${body.status}`,
    });
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    return apiError("INTERNAL_ERROR", "Update failed", 500);
  }
}
