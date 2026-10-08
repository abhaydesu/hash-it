import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { runInTestTransaction } from "@/tests/helpers/test-db";
import { createTestUser } from "@/tests/helpers/factories";

describe("test database isolation", () => {
  it("connects to the test schema, not the app's public schema", () => {
    expect(new URL(process.env.DATABASE_URL!).searchParams.get("schema")).toBe("test_hash_it");
  });

  it("rolls back rows created inside runInTestTransaction", async () => {
    const email = `isolation_${Date.now()}@example.com`;
    await runInTestTransaction(async (tx) => {
      await createTestUser({ email }, tx);
      expect(await tx.user.findUnique({ where: { email } })).not.toBeNull();
    });
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });
});
