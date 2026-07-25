import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminCategoriesClient from "./categories-client";

export default async function AdminCategoriesPage() {
  const { error } = await requireSession(["ADMIN", "CASHIER"]);
  if (error) redirect("/admin/login?next=/admin/categories");

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  return (
    <AdminCategoriesClient
      initialCategories={categories.map(({ _count, ...c }) => ({
        ...c,
        productCount: _count.products,
      }))}
    />
  );
}
