import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Bootstrap admin login only.
 * Shop profile, brands, categories, products, offers → Postgres via Admin UI.
 * Never seed catalogue or marketing copy here.
 */
async function main() {
  const passwordHash = await bcrypt.hash("Admin@12345", 12);

  const admin = await prisma.adminUser.upsert({
    where: { email: "admin@sparknova.in" },
    update: {
      passwordHash,
      role: "ADMIN",
      isActive: true,
      failedLogins: 0,
      lockedUntil: null,
    },
    create: {
      email: "admin@sparknova.in",
      username: "admin",
      passwordHash,
      role: "ADMIN",
    },
  });

  const cashierHash = await bcrypt.hash("Cashier@12345", 12);
  await prisma.adminUser.upsert({
    where: { email: "cashier@sparknova.in" },
    update: { passwordHash: cashierHash, role: "CASHIER", isActive: true },
    create: {
      email: "cashier@sparknova.in",
      username: "cashier",
      passwordHash: cashierHash,
      role: "CASHIER",
    },
  });

  // Empty shop row only if missing — fill via Admin → Settings
  await prisma.setting.upsert({
    where: { key: "shop" },
    update: {},
    create: {
      key: "shop",
      value: JSON.stringify({
        name: "",
        tagline: "",
        address: "",
        phone: "",
        whatsapp: "",
        email: "",
        hours: "",
        mapsUrl: "",
        languages: { en: true, ta: true, hi: false },
      }),
    },
  });

  await prisma.setting.upsert({
    where: { key: "loyalty" },
    update: {},
    create: {
      key: "loyalty",
      value: JSON.stringify({
        pointsPerHundred: 1,
        minRedemptionPoints: 1,
        maxDiscountPercent: 30,
        maxLoyaltyDiscountAmount: 5000,
        expiryMonths: 12,
        enabled: true,
      }),
    },
  });

  const [categories, products, brands, offers] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.brand.count(),
    prisma.offer.count(),
  ]);

  console.log("Seed OK. Admin:", admin.email, "password: Admin@12345");
  console.log(
    `Postgres catalogue — categories:${categories} products:${products} brands:${brands} offers:${offers}`
  );
  console.log("Shop / brands / products: manage in Admin UI only.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
