import { afterEach, beforeEach, vi } from "vitest";

// Global network guard: fail any test attempting a real external network request
const originalFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const parsed = new URL(url);
    if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      throw new Error(`[Network Guard] Real network request blocked in unit test: ${url}`);
    }
  }
  return originalFetch(input, init);
}) as typeof fetch;

beforeEach(() => {
  // Deterministic fake timer default for scheduling tests
  vi.useFakeTimers({ now: new Date("2026-09-17T12:00:00.000Z") });
});

afterEach(() => {
  vi.useRealTimers();
});
