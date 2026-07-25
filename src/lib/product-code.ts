import { prisma } from "@/lib/prisma";

/** Next incremental product code: PRD-0001, PRD-0002, … */
export async function nextProductCode() {
  const products = await prisma.product.findMany({
    select: { code: true },
  });

  let max = 0;
  for (const p of products) {
    const m = p.code.match(/^PRD-(\d+)$/i);
    if (m) max = Math.max(max, Number(m[1]));
  }

  // If no PRD-* yet, continue after total count so we don't collide with seed codes
  if (max === 0) {
    max = products.length;
  }

  let n = max + 1;
  for (;;) {
    const code = `PRD-${String(n).padStart(4, "0")}`;
    const exists = products.some(
      (p) => p.code.toUpperCase() === code
    );
    if (!exists) {
      const db = await prisma.product.findUnique({ where: { code } });
      if (!db) return code;
    }
    n++;
  }
}
