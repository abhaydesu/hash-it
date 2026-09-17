import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Allow only http(s) URLs or same-origin relative paths. */
export function safeHref(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "#") return undefined;
  if (trimmed.length > 2_000) return undefined;

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

export function formatMinutes(minutes?: number | null): string {
  if (minutes == null) return "-";
  if (minutes < 60) return `${minutes}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export function formatDifficulty(diff?: string | null): {
  label: string;
  className: string;
  variant: "easy" | "medium" | "hard" | "outline";
} {
  switch (diff) {
    case "EASY":
      return {
        label: "Easy",
        className: "border border-easy/50 bg-easy/20 text-easy font-semibold",
        variant: "easy",
      };
    case "MEDIUM":
      return {
        label: "Medium",
        className: "border border-medium/50 bg-medium/20 text-medium font-semibold",
        variant: "medium",
      };
    case "HARD":
      return {
        label: "Hard",
        className: "border border-hard/50 bg-hard/20 text-hard font-semibold",
        variant: "hard",
      };
    default:
      return {
        label: "Unknown",
        className: "border border-border bg-muted/40 text-muted-foreground",
        variant: "outline",
      };
  }
}

export function formatStatus(status?: string | null): {
  label: string;
  short: string;
  className: string;
  variant: "status-unaided" | "status-help" | "status-failed" | "outline";
} {
  if (!status) {
    return {
      label: "Unattempted",
      short: "Unattempted",
      className: "border border-border text-muted-foreground",
      variant: "outline",
    };
  }
  switch (status) {
    case "SOLVED_UNAIDED":
      return {
        label: "Unaided",
        short: "Unaided",
        className: "outcome-fill-good",
        variant: "status-unaided",
      };
    case "SOLVED_WITH_HELP":
      return {
        label: "With help",
        short: "With help",
        className: "outcome-fill-hint",
        variant: "status-help",
      };
    case "ATTEMPTED_FAILED":
      return {
        label: "Failed",
        short: "Failed",
        className: "outcome-fill-failed",
        variant: "status-failed",
      };
    default:
      return {
        label: status,
        short: status,
        className: "border border-border text-muted-foreground",
        variant: "outline",
      };
  }
}

export const formatSolveStatus = formatStatus;

/** Distinct pigments for pattern chips (inline styles — not Tailwind JIT). */
const PATTERN_PALETTE = [
  { bg: "hsl(152 52% 34% / 0.2)", border: "hsl(152 52% 34% / 0.55)", text: "hsl(152 55% 28%)" }, // green
  { bg: "hsl(214 68% 42% / 0.2)", border: "hsl(214 68% 42% / 0.55)", text: "hsl(214 70% 32%)" }, // blue
  { bg: "hsl(36 78% 40% / 0.2)", border: "hsl(36 78% 40% / 0.55)", text: "hsl(36 80% 30%)" }, // amber
  { bg: "hsl(8 68% 44% / 0.2)", border: "hsl(8 68% 44% / 0.55)", text: "hsl(8 70% 34%)" }, // terracotta
  { bg: "hsl(178 48% 32% / 0.2)", border: "hsl(178 48% 32% / 0.55)", text: "hsl(178 55% 26%)" }, // teal
  { bg: "hsl(280 48% 42% / 0.2)", border: "hsl(280 48% 42% / 0.55)", text: "hsl(280 50% 34%)" }, // plum
  { bg: "hsl(195 55% 38% / 0.2)", border: "hsl(195 55% 38% / 0.55)", text: "hsl(195 58% 30%)" }, // cyan
  { bg: "hsl(330 45% 42% / 0.2)", border: "hsl(330 45% 42% / 0.55)", text: "hsl(330 50% 34%)" }, // rose
  { bg: "hsl(55 60% 38% / 0.22)", border: "hsl(55 60% 38% / 0.55)", text: "hsl(55 65% 28%)" }, // olive
  { bg: "hsl(24 70% 42% / 0.2)", border: "hsl(24 70% 42% / 0.55)", text: "hsl(24 75% 32%)" }, // orange
  { bg: "hsl(250 40% 44% / 0.2)", border: "hsl(250 40% 44% / 0.55)", text: "hsl(250 45% 36%)" }, // indigo
  { bg: "hsl(165 40% 34% / 0.2)", border: "hsl(165 40% 34% / 0.55)", text: "hsl(165 45% 26%)" }, // seafoam
] as const;

/** Force distinct slots for common / easily-confused patterns. */
const PATTERN_COLOR_SLOT: Record<string, number> = {
  "two pointer": 1,
  "two pointers": 1,
  "sliding window": 2,
  hashmap: 9,
  "hash map": 9,
  "hash table": 9,
  stack: 0,
  heap: 6,
  "binary search": 10,
  binarysearch: 10,
  basics: 8,
  "prefix sum": 4,
  "merge intervals": 7,
  "dummy node": 5,
  "in-place reversal of linkedlist": 3,
  "in-place reversal of linked list": 3,
  "kadane's pattern": 9,
  "kadane’s pattern": 9,
  kadane: 9,
};

function normalizePatternKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "'")
    .replace(/\s+/g, " ");
}

function patternPaletteIndex(name: string): number {
  const key = normalizePatternKey(name);
  if (key in PATTERN_COLOR_SLOT) return PATTERN_COLOR_SLOT[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % PATTERN_PALETTE.length;
}

export function patternClayStyle(name: string): {
  backgroundColor: string;
  borderColor: string;
  color: string;
} {
  const swatch = PATTERN_PALETTE[patternPaletteIndex(name)];
  return {
    backgroundColor: swatch.bg,
    borderColor: swatch.border,
    color: swatch.text,
  };
}

/** @deprecated Prefer patternClayStyle — kept for any leftover className callers. */
export function patternClayClass(_name: string): string {
  return "border";
}

/** Split comma/semicolon-joined pattern strings into distinct labels. */
export function normalizePatternList(patterns: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of patterns) {
    if (!raw) continue;
    for (const part of raw.split(/[,;|]/)) {
      const trimmed = part.trim().replace(/\s+/g, " ");
      if (!trimmed) continue;
      const key = normalizePatternKey(trimmed);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }
  }
  return out;
}
