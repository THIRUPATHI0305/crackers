import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaRev?: string;
};

/** Busts stale HMR clients after `prisma generate`. */
function schemaRev() {
  return Prisma.dmmf.datamodel.models
    .map((m) => `${m.name}:${m.fields.map((f) => f.name).join(",")}`)
    .join("|");
}

function createPrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getPrisma(): PrismaClient {
  const rev = schemaRev();
  if (
    !globalForPrisma.prisma ||
    globalForPrisma.prismaSchemaRev !== rev
  ) {
    void globalForPrisma.prisma?.$disconnect().catch(() => undefined);
    globalForPrisma.prisma = createPrisma();
    globalForPrisma.prismaSchemaRev = rev;
  }
  return globalForPrisma.prisma;
}

/**
 * Proxy so every access uses a client matching the current generated schema.
 * (Plain `export const prisma = …` freezes a stale instance across Next.js HMR.)
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop as string | symbol, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
