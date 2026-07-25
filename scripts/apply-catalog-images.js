/**
 * Apply catalog images: set each category + all its products to /images/catalog/{slug}.jpg
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const mapPath = path.join(__dirname, "..", "tmp", "catalog-image-map.json");

async function main() {
  const mapping = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  let catUpdated = 0;
  let prodUpdated = 0;

  for (const [slug, imageUrl] of Object.entries(mapping)) {
    const cat = await prisma.category.updateMany({
      where: { slug },
      data: { imageUrl },
    });
    catUpdated += cat.count;

    const found = await prisma.category.findUnique({ where: { slug } });
    if (!found) {
      console.log("skip missing category", slug);
      continue;
    }
    const prods = await prisma.product.updateMany({
      where: { categoryId: found.id },
      data: { imageUrl },
    });
    prodUpdated += prods.count;
    console.log(`${slug}: category=${cat.count} products=${prods.count} -> ${imageUrl}`);
  }

  console.log(`Done. categories=${catUpdated} products=${prodUpdated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
