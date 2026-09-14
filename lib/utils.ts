import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinutes(minutes?: number | null): string {
  if (minutes == null) return "-";
  if (minutes < 60) return `${minutes}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export function formatDifficulty(diff?: string | null): { label: string; className: string } {
  switch (diff) {
    case "EASY":
      return {
        label: "Easy",
        className: "bg-emerald-950/70 text-emerald-300 border-emerald-800/60",
      };
    case "MEDIUM":
      return {
        label: "Medium",
        className: "bg-amber-950/70 text-amber-300 border-amber-800/60",
      };
    case "HARD":
      return {
        label: "Hard",
        className: "bg-rose-950/70 text-rose-300 border-rose-800/60",
      };
    default:
      return {
        label: "Unknown",
        className: "bg-zinc-800 text-zinc-400 border-zinc-700",
      };
  }
}

export function formatStatus(status?: string | null): { label: string; short: string; className: string } {
  if (!status) {
    return {
      label: "Unattempted",
      short: "Unattempted",
      className: "bg-zinc-800 text-zinc-400 border-zinc-700",
    };
  }
  switch (status) {
    case "SOLVED_UNAIDED":
      return {
        label: "Unaided",
        short: "Unaided",
        className: "bg-emerald-950/70 text-emerald-300 border-emerald-800/60",
      };
    case "SOLVED_WITH_HELP":
      return {
        label: "With Help",
        short: "With Help",
        className: "bg-sky-950/70 text-sky-300 border-sky-800/60",
      };
    case "ATTEMPTED_FAILED":
      return {
        label: "Failed",
        short: "Failed",
        className: "bg-rose-950/70 text-rose-300 border-rose-800/60",
      };
    default:
      return {
        label: status,
        short: status,
        className: "bg-zinc-800 text-zinc-300 border-zinc-700",
      };
  }
}

export const formatSolveStatus = formatStatus;
