import { prisma } from "@/lib/prisma";

export async function runInTestTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  let result: T;
  const globalAny = globalThis as any;
  try {
    await prisma.$transaction(
      async (tx) => {
        globalAny.__testTxClient = tx;
        try {
          result = await fn(tx);
        } finally {
          globalAny.__testTxClient = null;
        }
        throw new Error("__TEST_ROLLBACK__");
      },
      { timeout: 25000 }
    );
  } catch (err: any) {
    if (err?.message === "__TEST_ROLLBACK__") {
      return result!;
    }
    throw err;
  }
  return result!;
}
