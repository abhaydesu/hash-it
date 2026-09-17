import { safeHref } from "@/lib/utils";

export function parseSlugFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const problemsIndex = parts.indexOf("problems");
    if (problemsIndex !== -1 && problemsIndex + 1 < parts.length) {
      return parts[problemsIndex + 1].toLowerCase().replace(/[^a-z0-9-]/g, "");
    }
    const last = parts[parts.length - 1];
    return last ? last.toLowerCase().replace(/[^a-z0-9-]/g, "") : null;
  } catch {
    const cleanUrl = url.trim().replace(/\/+$/, "").replace(/\/(description|submissions|editorial|1)$/i, "");
    const parts = cleanUrl.split("/");
    const last = parts[parts.length - 1];
    return last ? last.toLowerCase().replace(/[^a-z0-9-]/g, "") : null;
  }
}

export function normalizeProblemUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

/** Variants for matching stored problem URLs (trailing slash, /1 suffix, normalized href). */
export function problemUrlLookupKeys(url: string): string[] {
  const keys = new Set<string>();
  const add = (raw?: string | null) => {
    if (!raw) return;
    const norm = normalizeProblemUrl(raw);
    keys.add(norm);
    keys.add(norm.replace(/\/1$/, ""));
  };
  add(url);
  add(safeHref(url));
  return [...keys];
}

export function titleFromProblemUrl(url: string): string | null {
  const slug = parseSlugFromUrl(url);
  if (!slug) return null;
  return slug.replace(/-/g, " ");
}
