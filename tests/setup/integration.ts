import { beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";

// Mock next/cache so revalidatePath doesn't throw outside Next.js request context
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Global network guard: fail any test attempting a real external network request
const originalFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const parsed = new URL(url);
    if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      throw new Error(`[Network Guard] Real network request blocked in integration test: ${url}`);
    }
  }
  return originalFetch(input, init);
}) as typeof fetch;

// Ensure integration tests use test schema
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("schema=test_hash_it")) {
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("schema", "test_hash_it");
  process.env.DATABASE_URL = url.toString();
}

afterAll(async () => {
  await prisma.$disconnect();
});
