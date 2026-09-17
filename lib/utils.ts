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

export function formatDifficulty(diff?: string | null): { label: string; className: string; variant: "easy" | "medium" | "hard" | "outline" } {
  switch (diff) {
    case "EASY":
      return {
        label: "Easy",
        className: "border border-easy/35 text-easy",
        variant: "easy",
      };
    case "MEDIUM":
      return {
        label: "Medium",
        className: "border border-medium/35 text-medium",
        variant: "medium",
      };
    case "HARD":
      return {
        label: "Hard",
        className: "border border-hard/35 text-hard",
        variant: "hard",
      };
    default:
      return {
        label: "Unknown",
        className: "border border-border text-muted-foreground",
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
        className: "border border-easy/35 text-easy",
        variant: "status-unaided",
      };
    case "SOLVED_WITH_HELP":
      return {
        label: "With help",
        short: "With help",
        className: "border border-border text-muted-foreground",
        variant: "status-help",
      };
    case "ATTEMPTED_FAILED":
      return {
        label: "Failed",
        short: "Failed",
        className: "border border-destructive/40 text-destructive",
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
