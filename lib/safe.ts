import { timingSafeEqual } from "crypto";

export const LIMITS = {
  note: 20_000,
  title: 500,
  url: 2_000,
  csvChars: 2_000_000,
  importRows: 8_000,
  searchQuery: 200,
} as const;

/** Allow only http(s) URLs or same-origin relative paths. Client-safe. */
export function safeHref(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "#") return undefined;
  if (trimmed.length > LIMITS.url) return undefined;

  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\")) {
    if (trimmed.includes("://")) return undefined;
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function storedHttpUrl(url?: string | null): string {
  return safeHref(url) ?? "";
}

export function isSafeCallbackPath(pathname: string): boolean {
  return (
    pathname.startsWith("/") &&
    !pathname.startsWith("//") &&
    !pathname.includes("\\") &&
    !pathname.includes("://")
  );
}

export function secretsEqual(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
