import { SolveStatus, Difficulty } from "@prisma/client";

export interface DryRunRow {
  rowIndex: number;
  rawName: string;
  rawLink: string;
  rawTopic?: string;
  rawPattern?: string;
  rawIdea?: string;
  rawMistake?: string;
  rawStatus?: string;
  rawRevisit?: string;
  rawSource?: string;
  rawSolvedDate?: string;
  rawDifficulty?: string;
  rawMinutes?: string;
  /** Raw cells for the user's own columns, keyed by custom field id. */
  customRaw?: Record<string, string>;

  // Derived / Mapped fields
  matchedProblemId?: string;
  matchedTitle?: string;
  matchedPlatform?: string;
  matchedNumber?: number | null;
  matchMethod?: "SLUG" | "NUMBER" | "TITLE_EXACT" | "FUZZY_CONFIRMATION" | "WILL_CREATE_GFG" | "WILL_CREATE_OTHER";
  parsedStatus: SolveStatus;
  parsedRevisit: boolean;
  parsedDifficulty?: Difficulty;
  parsedMinutes?: number;
  needsConfirmation: boolean;

  // Duplicate / conflict detection
  isDuplicateInCSV?: boolean;
  duplicateGroupId?: string;
  alreadyExistsInDB?: boolean;
  existingEntrySummary?: string;
}

export { parseSlugFromUrl, normalizeProblemUrl, problemUrlLookupKeys, titleFromProblemUrl } from "@/lib/problem-url";

export function parseLeadingNumber(title: string): number | null {
  if (!title) return null;
  const match = title.trim().match(/^(\d+)[\.\s\-]/);
  if (match) {
    const num = parseInt(match[1], 10);
    return isNaN(num) ? null : num;
  }
  return null;
}

export function mapRawStatus(raw?: string): SolveStatus {
  if (!raw) return SolveStatus.SOLVED_UNAIDED;
  const lower = raw.trim().toLowerCase();
  if (lower.includes("no help") || lower.includes("unaided") || lower === "solved") {
    return SolveStatus.SOLVED_UNAIDED;
  }
  if (lower.includes("with help") || lower.includes("hint")) {
    return SolveStatus.SOLVED_WITH_HELP;
  }
  if (lower.includes("fail") || lower.includes("attempt") || lower.includes("wrong")) {
    return SolveStatus.ATTEMPTED_FAILED;
  }
  return SolveStatus.SOLVED_UNAIDED;
}

export function mapRawDifficulty(raw?: string): Difficulty | undefined {
  if (!raw) return undefined;
  const lower = raw.trim().toLowerCase();
  if (lower === "easy" || lower === "e") return Difficulty.EASY;
  if (lower === "medium" || lower === "med" || lower === "m") return Difficulty.MEDIUM;
  if (lower === "hard" || lower === "h") return Difficulty.HARD;
  return undefined;
}

export function parseRawMinutes(raw?: string): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().replace(/\s*(min|mins|minutes|m)$/i, "").trim();
  const num = parseInt(cleaned, 10);
  if (isNaN(num) || num < 0 || num > 9999) return undefined;
  return num;
}

export function mapRawRevisit(raw?: string): boolean {
  if (!raw) return false;
  const lower = raw.trim().toLowerCase();
  return lower === "yes" || lower === "true" || lower === "y" || lower === "1";
}

/**
 * Strip LLM citation / grounding artefacts from raw CSV text before it hits Papa.parse.
 *
 * Some assistants (notably Gemini with search grounding enabled) wrap URLs in
 * markdown link syntax like `[https://leetcode.com/…/,BFS,Traverse](https://www.google.com/search?q=…&utm_source=gemini)`.
 * Those wrappers contain unquoted commas that shatter column boundaries. We unwrap
 * `[X](Y)` to just `X`, which is the label the model actually intended in the cell,
 * and drop trailing citation footnotes like `[1]` or `[source]` that Gemini also emits.
 *
 * Also strips code fences the LLM may wrap the CSV in, and Unicode BOM.
 *
 * Returns `{ cleaned, artefactCount }` — callers can surface `artefactCount > 0` as a
 * "your LLM injected citations, be careful" warning.
 */
export function sanitizeCsvText(raw: string): { cleaned: string; artefactCount: number } {
  if (typeof raw !== "string" || raw.length === 0) return { cleaned: raw ?? "", artefactCount: 0 };

  let text = raw;
  let artefactCount = 0;

  // Drop UTF-8 BOM.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  // Strip surrounding triple-backtick code fences (```csv ... ``` or ``` ... ```).
  text = text.replace(/^\s*```(?:csv|CSV)?\s*\n([\s\S]*?)\n\s*```\s*$/m, (_m, inner) => {
    artefactCount++;
    return inner;
  });

  // Unwrap markdown links `[LABEL](URL)` → `LABEL`. Non-greedy label; URL must be http/https.
  // We only match links whose URL starts with a scheme so we don't eat legit `[foo](bar)` text
  // that isn't actually a link.
  text = text.replace(/\[([^\]\n]{1,2000}?)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label) => {
    artefactCount++;
    return label;
  });

  // Strip common citation footnotes: [1], [12], [source], [ref], [note]
  text = text.replace(/\[(?:\d{1,3}|source|ref|note|citation)\]/gi, () => {
    artefactCount++;
    return "";
  });

  // Strip Gemini's own `utm_source=gemini` trailing query fragment if it survived after unwrap.
  text = text.replace(/[?&]utm_source=gemini(?:&|\b)/g, () => {
    artefactCount++;
    return "";
  });

  return { cleaned: text, artefactCount };
}

/**
 * Parse a solved-date cell. Accepts ISO-ish YYYY-MM-DD (what the LC prompt asks for)
 * plus a few forgiving variants (MM/DD/YYYY, DD/MM/YYYY when unambiguous, full ISO).
 * Rejects future dates and dates before LeetCode existed (2015-01-01), and returns
 * undefined for anything unparsable so the caller can fall back to `new Date()`.
 */
export function parseSolvedDate(raw?: string, now: Date = new Date()): Date | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  const slashMatch = !isoMatch && trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);

  let year: number, month: number, day: number;
  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else if (slashMatch) {
    // Ambiguous: default to MM/DD/YYYY (LC's own display), swap if month > 12.
    let a = Number(slashMatch[1]);
    let b = Number(slashMatch[2]);
    year = Number(slashMatch[3]);
    if (a > 12 && b <= 12) {
      [a, b] = [b, a];
    }
    month = a;
    day = b;
  } else {
    return undefined;
  }

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime())) return undefined;
  // Round-trip check to reject invalid days-in-month (e.g. Feb 31).
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return undefined;
  }

  const earliest = Date.UTC(2015, 0, 1);
  if (parsed.getTime() < earliest) return undefined;
  // Allow up to 1 day in the future for timezone slop; reject clearly-future dates.
  if (parsed.getTime() > now.getTime() + 24 * 60 * 60 * 1000) return undefined;

  return parsed;
}

export function mergeTwoRows(rowA: DryRunRow, rowB: DryRunRow): DryRunRow {
  // Merge Ideas
  let mergedIdea: string | undefined = undefined;
  if (rowA.rawIdea && rowB.rawIdea) {
    if (rowA.rawIdea.trim() === rowB.rawIdea.trim()) {
      mergedIdea = rowA.rawIdea.trim();
    } else {
      mergedIdea = `${rowA.rawIdea.trim()}\n\n---\n[Note from Row ${rowB.rowIndex}]: ${rowB.rawIdea.trim()}`;
    }
  } else {
    mergedIdea = rowA.rawIdea || rowB.rawIdea;
  }

  // Merge Mistakes
  let mergedMistake: string | undefined = undefined;
  if (rowA.rawMistake && rowB.rawMistake) {
    if (rowA.rawMistake.trim() === rowB.rawMistake.trim()) {
      mergedMistake = rowA.rawMistake.trim();
    } else {
      mergedMistake = `${rowA.rawMistake.trim()}\n\n---\n[Trap from Row ${rowB.rowIndex}]: ${rowB.rawMistake.trim()}`;
    }
  } else {
    mergedMistake = rowA.rawMistake || rowB.rawMistake;
  }

  // Merge Patterns
  let mergedPattern = rowA.rawPattern;
  if (!mergedPattern && rowB.rawPattern) mergedPattern = rowB.rawPattern;

  // Merge Topic
  let mergedTopic = rowA.rawTopic;
  if (!mergedTopic && rowB.rawTopic) mergedTopic = rowB.rawTopic;

  // Merge Revisit
  const mergedRevisit = rowA.parsedRevisit || rowB.parsedRevisit;

  // Merge Status
  let mergedStatus = rowA.parsedStatus;
  if (rowA.parsedStatus === SolveStatus.SOLVED_UNAIDED && rowB.parsedStatus !== SolveStatus.SOLVED_UNAIDED) {
    mergedStatus = rowB.parsedStatus;
  }

  // Merge Source
  const sources = [rowA.rawSource, rowB.rawSource].filter(Boolean);
  const uniqueSources = Array.from(new Set(sources));
  const mergedSource = uniqueSources.join(", ") || undefined;

  // Merge Solved Date — pick the later of the two parseable dates.
  const dateA = parseSolvedDate(rowA.rawSolvedDate);
  const dateB = parseSolvedDate(rowB.rawSolvedDate);
  let mergedSolvedDate: string | undefined = rowA.rawSolvedDate || rowB.rawSolvedDate;
  if (dateA && dateB) {
    mergedSolvedDate = dateA.getTime() >= dateB.getTime() ? rowA.rawSolvedDate : rowB.rawSolvedDate;
  } else if (dateB && !dateA) {
    mergedSolvedDate = rowB.rawSolvedDate;
  }

  return {
    ...rowA,
    rawPattern: mergedPattern,
    rawTopic: mergedTopic,
    rawIdea: mergedIdea,
    rawMistake: mergedMistake,
    rawSource: mergedSource,
    rawSolvedDate: mergedSolvedDate,
    // Custom cells: first row wins per field, gaps filled from the second.
    customRaw:
      rowA.customRaw || rowB.customRaw ? { ...rowB.customRaw, ...rowA.customRaw } : undefined,
    parsedRevisit: mergedRevisit,
    rawRevisit: mergedRevisit ? "Yes" : "No",
    parsedStatus: mergedStatus,
    isDuplicateInCSV: false,
    duplicateGroupId: undefined,
  };
}
