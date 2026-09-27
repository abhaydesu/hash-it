import { env } from "@/lib/env";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  __testTxClient: any | undefined;
};

/**
 * Neon suspends idle computes; waking one (especially through the "-pooler" host) can
 * exceed Prisma's 5s connect default and surface as "Can't reach database server".
 * Explicit values in DATABASE_URL still win.
 */
function withConnectionDefaults(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "15");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "15");
    return url.toString();
  } catch {
    return raw;
  }
}

const rawPrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: withConnectionDefaults(process.env.DATABASE_URL),
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
