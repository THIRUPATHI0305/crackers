import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminStockClient } from "./stock-client";

export default async function AdminStockPage() {
  const { error } = await requireSession(["ADMIN", "CASHIER"]);
  if (error) redirect("/admin/login?next=/admin/stock");

  const products = await prisma.product.findMany({
    select: {
      id: true,
      nameEn: true,
      code: true,
      stock: true,
      minStock: true,
      offerPrice: true,
    },
    orderBy: [{ nameEn: "asc" }],
  });

  return <AdminStockClient initialProducts={products} />;
}
