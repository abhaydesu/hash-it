import { describe, it, expect } from "vitest";
import { findOrCreateLocalUser } from "../lib/auth";
import { prisma } from "../lib/prisma";

describe("local auth identity", () => {
  it("creates distinct local users for different emails", async () => {
    const first = await findOrCreateLocalUser("alice@example.com");
    const second = await findOrCreateLocalUser("bob@example.com");

    expect(first.id).not.toBe(second.id);
    expect(first.email).toBe("alice@example.com");
    expect(second.email).toBe("bob@example.com");

    await prisma.user.deleteMany({
      where: {
        email: { in: ["alice@example.com", "bob@example.com"] },
      },
    });
  });
});
