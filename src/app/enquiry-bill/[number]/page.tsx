import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * Old estimate links (/enquiry-bill/ENQ-…) redirect to the tax invoice when billed,
 * otherwise home — estimate WhatsApp is removed.
 */
export default async function PublicEnquiryBillPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number: key } = await params;
  const enquiry = await prisma.enquiry.findFirst({
    where: { number: key },
    include: {
      invoice: { select: { publicToken: true } },
    },
  });
  if (!enquiry) notFound();
  if (enquiry.invoice?.publicToken) {
    redirect(`/invoice/${enquiry.invoice.publicToken}`);
  }
  redirect("/");
}
