import { SolveStatus } from "@prisma/client";

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

  // Derived / Mapped fields
  matchedProblemId?: string;
  matchedTitle?: string;
  matchedPlatform?: string;
  matchedNumber?: number | null;
  matchMethod?: "SLUG" | "NUMBER" | "TITLE_EXACT" | "FUZZY_CONFIRMATION" | "WILL_CREATE_GFG" | "WILL_CREATE_OTHER";
  parsedStatus: SolveStatus;
  parsedRevisit: boolean;
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

export function mapRawRevisit(raw?: string): boolean {
  if (!raw) return false;
  const lower = raw.trim().toLowerCase();
  return lower === "yes" || lower === "true" || lower === "y" || lower === "1";
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

  return {
    ...rowA,
    rawPattern: mergedPattern,
    rawTopic: mergedTopic,
    rawIdea: mergedIdea,
    rawMistake: mergedMistake,
    rawSource: mergedSource,
    parsedRevisit: mergedRevisit,
    rawRevisit: mergedRevisit ? "Yes" : "No",
    parsedStatus: mergedStatus,
    isDuplicateInCSV: false,
    duplicateGroupId: undefined,
  };
}
