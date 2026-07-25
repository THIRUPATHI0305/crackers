import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminProductsClient } from "./products-client";

export default async function AdminProductsPage() {
  const { error } = await requireSession(["ADMIN", "CASHIER"]);
  if (error) redirect("/admin/login?next=/admin/products");

  const products = await prisma.product.findMany({
    include: {
      category: { select: { nameEn: true } },
      brand: { select: { nameEn: true } },
    },
    orderBy: [{ nameEn: "asc" }],
  });

  return (
    <AdminProductsClient
      products={products.map((p) => ({
        id: p.id,
        nameEn: p.nameEn,
        code: p.code,
        offerPrice: p.offerPrice,
        originalPrice: p.originalPrice,
        stock: p.stock,
        category: p.category,
        brand: p.brand,
      }))}
    />
  );
}
