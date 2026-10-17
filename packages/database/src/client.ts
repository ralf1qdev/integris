import { PrismaClient, Prisma } from "@prisma/client";

export type Db = PrismaClient | Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as { __integrisPrisma?: PrismaClient };

/** Shared Prisma client. Reused across hot reloads in development. */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__integrisPrisma) {
    globalForPrisma.__integrisPrisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }
  return globalForPrisma.__integrisPrisma;
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}
