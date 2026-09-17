import { env } from "@/lib/env";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  __testTxClient: any | undefined;
};

const rawPrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = rawPrisma;

export const prisma = new Proxy(rawPrisma, {
  get(target, prop, receiver) {
    if (globalForPrisma.__testTxClient) {
      if (prop === "$transaction") {
        return async (arg: any, options?: any) => {
          if (typeof arg === "function") {
            return await arg(globalForPrisma.__testTxClient);
          }
          if (Array.isArray(arg)) {
            return await Promise.all(arg);
          }
          return (globalForPrisma.__testTxClient as any).$transaction(arg, options);
        };
      }
      if (prop in globalForPrisma.__testTxClient) {
        return (globalForPrisma.__testTxClient as any)[prop];
      }
    }
    return Reflect.get(target, prop, receiver);
  },
});
