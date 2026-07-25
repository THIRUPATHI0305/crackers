import { prisma } from "@/lib/prisma";
import { getLoyaltyPublicSettings } from "@/lib/shop-settings";

/** Loyalty note marker — used to avoid double-awarding for the same enquiry. */
export function enquiryPaidLoyaltyNote(enquiryNumber: string) {
  return `ENQUIRY_PAID:${enquiryNumber}`;
}

export function pointsForAmount(amount: number, pointsPerHundred: number) {
  if (pointsPerHundred <= 0 || amount <= 0) return 0;
  return Math.floor((amount / 100) * pointsPerHundred);
}

/**
 * Credit loyalty for a paid enquiry amount (once).
 * Points become available on the customer's next bill.
 */
export async function awardEnquiryPaidPoints(opts: {
  enquiryId: string;
  enquiryNumber: string;
  estimatedAmount: number;
  customerId: string;
  phone: string;
}) {
  const loyalty = await getLoyaltyPublicSettings();
  if (!loyalty.enabled) {
    return { awarded: 0, alreadyAwarded: false, reason: "disabled" as const };
  }

  const pts = pointsForAmount(opts.estimatedAmount, loyalty.pointsPerHundred);
  if (pts <= 0) {
    return { awarded: 0, alreadyAwarded: false, reason: "zero" as const };
  }

  const note = enquiryPaidLoyaltyNote(opts.enquiryNumber);
  const phone = opts.phone.replace(/\D/g, "");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.loyaltyTransaction.findFirst({
      where: { note, type: "EARNED" },
    });
    if (existing) {
      return {
        awarded: existing.points,
        alreadyAwarded: true,
        reason: "duplicate" as const,
      };
    }

    const account = await tx.loyaltyAccount.upsert({
      where: { phone },
      update: {
        availablePoints: { increment: pts },
        earnedPoints: { increment: pts },
      },
      create: {
        phone,
        customerId: opts.customerId,
        availablePoints: pts,
        earnedPoints: pts,
      },
    });

    await tx.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        type: "EARNED",
        points: pts,
        note,
      },
    });

    return { awarded: pts, alreadyAwarded: false, reason: "ok" as const };
  });
}

export async function enquiryAlreadyAwardedPoints(enquiryNumber: string) {
  const note = enquiryPaidLoyaltyNote(enquiryNumber);
  const row = await prisma.loyaltyTransaction.findFirst({
    where: { note, type: "EARNED" },
    select: { points: true },
  });
  return row?.points ?? 0;
}
