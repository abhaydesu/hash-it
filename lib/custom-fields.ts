/**
 * User-defined columns ("custom fields") and CSV column mapping.
 *
 * The scheduler only ever reads built-in fields (status, solved date, revisit…).
 * Everything else a user tracks in their own sheet lives in `Entry.customValues`,
 * described by `UserSettings.customFields`. Pure module — no Prisma, safe on client.
 */
import { z } from "zod";

export const CUSTOM_FIELD_TYPES = ["text", "number", "boolean", "date", "select"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const MAX_CUSTOM_FIELDS = 30;
export const MAX_SELECT_OPTIONS = 12;
const MAX_TEXT_VALUE = 2000;

export const CustomFieldDefSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{1,40}$/),
  label: z.string().trim().min(1).max(60),
  type: z.enum(CUSTOM_FIELD_TYPES),
  options: z.array(z.string().trim().min(1).max(40)).max(MAX_SELECT_OPTIONS).optional(),
});
export type CustomFieldDef = z.infer<typeof CustomFieldDefSchema>;

export type CustomValue = string | number | boolean;
export type CustomValues = Record<string, CustomValue>;

/** Parse whatever is stored in the DB into valid defs, dropping anything malformed. */
export function readCustomFieldDefs(raw: unknown): CustomFieldDef[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomFieldDef[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const parsed = CustomFieldDefSchema.safeParse(item);
    if (parsed.success && !seen.has(parsed.data.id)) {
      seen.add(parsed.data.id);
      out.push(parsed.data);
    }
  }
  return out.slice(0, MAX_CUSTOM_FIELDS);
}

/** Stable, readable id from a label: "Time Complexity" → "time_complexity". */
export function fieldIdFromLabel(label: string, taken: Iterable<string> = []): string {
  const base =
    label
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "field";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}_${i}`;
    if (!used.has(candidate)) return candidate;
  }
}

// ── Built-in fields ─────────────────────────────────────────────────────────

export const BUILTIN_FIELDS = [
  { key: "name", label: "Problem name", aliases: ["problem name", "problem", "title", "name", "question", "question name", "problem title"] },
  { key: "link", label: "Problem link", aliases: ["problem link", "problem link font", "link", "url", "problem url", "question link", "leetcode link"] },
  { key: "topic", label: "Topic", aliases: ["topic", "topics", "category", "data structure"] },
  { key: "pattern", label: "Pattern", aliases: ["pattern", "patterns", "technique", "approach type"] },
  { key: "idea", label: "Idea", aliases: ["idea", "key idea", "notes", "note", "intuition", "approach", "solution idea"] },
  { key: "mistake", label: "Mistake", aliases: ["what i did wrong", "mistake", "mistakes", "trap", "pitfall", "gotcha"] },
  { key: "difficulty", label: "Difficulty", aliases: ["difficulty", "diff", "level"] },
  { key: "minutes", label: "Time (minutes)", aliases: ["time", "time (min)", "time (mins)", "time (minutes)", "minutes", "mins", "duration", "time spent"] },
  { key: "status", label: "Status", aliases: ["status", "result", "outcome", "solved"] },
  { key: "revisit", label: "Revisit", aliases: ["revisit?", "revisit", "redo", "review again", "needs review"] },
  { key: "source", label: "Source", aliases: ["source", "list", "sheet", "from"] },
  { key: "solvedDate", label: "Solved date", aliases: ["solved date", "solved_date", "date", "date solved", "solved on", "completed"] },
] as const;

export type BuiltinFieldKey = (typeof BUILTIN_FIELDS)[number]["key"];
export const BUILTIN_KEYS = BUILTIN_FIELDS.map((f) => f.key) as BuiltinFieldKey[];

/** Where one CSV column goes. */
export type ColumnTarget =
  | { kind: "builtin"; key: BuiltinFieldKey }
  | { kind: "custom"; fieldId: string }
  | { kind: "ignore" };

/** header → target. Headers are the CSV's own strings. */
export type ColumnMapping = Record<string, ColumnTarget>;

export const ColumnTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("builtin"), key: z.enum(BUILTIN_KEYS as [BuiltinFieldKey, ...BuiltinFieldKey[]]) }),
  z.object({ kind: z.literal("custom"), fieldId: z.string().regex(/^[a-z0-9_]{1,40}$/) }),
  z.object({ kind: z.literal("ignore") }),
]);
export const ColumnMappingSchema = z.record(z.string().max(200), ColumnTargetSchema);

/** "Redo?", "solved_date", " Company " → "redo", "solved date", "company". */
const normalizeHeader = (h: string) =>
  h
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Suggest a destination for every header. Exact alias hits win; each built-in is
 * claimed by at most one column (the first). Headers matching an existing custom
 * field's label map to it, so a sheet you keep maintaining re-imports cleanly.
 * Everything else becomes a new custom field (by the caller) — `null` here.
 */
export function suggestMapping(
  headers: string[],
  existing: CustomFieldDef[] = []
): Record<string, ColumnTarget | null> {
  const claimed = new Set<BuiltinFieldKey>();
  const byLabel = new Map(existing.map((f) => [normalizeHeader(f.label), f.id]));
  const out: Record<string, ColumnTarget | null> = {};

  for (const header of headers) {
    const norm = normalizeHeader(header);
    if (!norm) {
      out[header] = { kind: "ignore" };
      continue;
    }
    const builtin = BUILTIN_FIELDS.find(
      (f) => !claimed.has(f.key) && f.aliases.some((alias) => normalizeHeader(alias) === norm)
    );
    if (builtin) {
      claimed.add(builtin.key);
      out[header] = { kind: "builtin", key: builtin.key };
      continue;
    }
    const existingId = byLabel.get(norm);
    out[header] = existingId ? { kind: "custom", fieldId: existingId } : null;
  }
  return out;
}

// ── Type inference & coercion ──────────────────────────────────────────────

const TRUE_WORDS = new Set(["yes", "y", "true", "✓", "✔", "x", "done"]);
const FALSE_WORDS = new Set(["no", "n", "false", "✗", "✘", ""]);
const BOOL_WORDS = new Set([...TRUE_WORDS, ...FALSE_WORDS]);

function parseBoolean(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (TRUE_WORDS.has(v) || v === "1") return true;
  if (FALSE_WORDS.has(v) || v === "0") return false;
  return null;
}

function parseNumber(raw: string): number | null {
  const v = raw.trim().replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** YYYY-MM-DD, or D/M/YYYY-ish (month-first unless impossible). Returns ISO date or null. */
function parseDateValue(raw: string): string | null {
  const v = raw.trim();
  let y: number, m: number, d: number;
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  const slash = !iso && v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (slash) {
    let a = Number(slash[1]);
    let b = Number(slash[2]);
    y = Number(slash[3]);
    if (a > 12 && b <= 12) [a, b] = [b, a];
    [m, d] = [a, b];
  } else {
    return null;
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/**
 * Guess a column's type from its values. Blank cells don't vote. Order matters:
 * a column of 0/1 reads as a number unless a yes/no word appears somewhere.
 */
export function inferFieldType(values: string[]): { type: CustomFieldType; options?: string[] } {
  const filled = values.map((v) => v.trim()).filter(Boolean);
  if (filled.length === 0) return { type: "text" };

  const lower = filled.map((v) => v.toLowerCase());
  if (lower.every((v) => BOOL_WORDS.has(v) || v === "0" || v === "1") && lower.some((v) => BOOL_WORDS.has(v))) {
    return { type: "boolean" };
  }
  if (filled.every((v) => parseNumber(v) !== null)) return { type: "number" };
  if (filled.every((v) => parseDateValue(v) !== null)) return { type: "date" };

  // A short, repeated vocabulary reads as a pick-list (e.g. Company, Confidence).
  const distinct = [...new Map(filled.map((v) => [v.toLowerCase(), v])).values()];
  if (
    distinct.length >= 2 &&
    distinct.length <= MAX_SELECT_OPTIONS &&
    filled.length >= distinct.length * 2 &&
    distinct.every((v) => v.length <= 40)
  ) {
    return { type: "select", options: distinct.sort((a, b) => a.localeCompare(b)) };
  }
  return { type: "text" };
}

/** Convert a raw cell to the field's type. `null` = blank or unconvertible (dropped). */
export function coerceCustomValue(def: CustomFieldDef, raw: unknown): CustomValue | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "boolean") return def.type === "boolean" ? raw : null;
  if (typeof raw === "number") {
    if (def.type === "number") return Number.isFinite(raw) ? raw : null;
    raw = String(raw);
  }
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;

  switch (def.type) {
    case "number":
      return parseNumber(v);
    case "boolean":
      return parseBoolean(v);
    case "date":
      return parseDateValue(v);
    case "select": {
      const hit = def.options?.find((o) => o.toLowerCase() === v.toLowerCase());
      // Unknown values are kept as text rather than lost; the editor shows them as-is.
      return hit ?? v.slice(0, 40);
    }
    default:
      return v.slice(0, MAX_TEXT_VALUE);
  }
}

/** Keep only values for known fields, coerced to their types. */
export function sanitizeCustomValues(defs: CustomFieldDef[], values: unknown): CustomValues {
  if (!values || typeof values !== "object" || Array.isArray(values)) return {};
  const out: CustomValues = {};
  for (const def of defs) {
    const coerced = coerceCustomValue(def, (values as Record<string, unknown>)[def.id]);
    if (coerced !== null) out[def.id] = coerced;
  }
  return out;
}

/** Filter out custom fields whose label matches a built-in field alias (e.g. "Difficulty", "Time (min)"). */
export function filterNonOverlappingFields(fields: CustomFieldDef[]): CustomFieldDef[] {
  return fields.filter((f) => {
    const norm = f.label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return !BUILTIN_FIELDS.some((bf) =>
      bf.aliases.some((alias) => alias.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === norm)
    );
  });
}

/** Display a stored value. */
export function formatCustomValue(def: CustomFieldDef, value: CustomValue | undefined): string {
  if (value === undefined || value === null || value === "") return "";
  if (def.type === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** Add options discovered in new data to a select field (capped). */
export function mergeSelectOptions(def: CustomFieldDef, extra: string[]): CustomFieldDef {
  if (def.type !== "select") return def;
  const opts = [...(def.options ?? [])];
  for (const e of extra) {
    const v = e.trim();
    if (v && !opts.some((o) => o.toLowerCase() === v.toLowerCase()) && opts.length < MAX_SELECT_OPTIONS) {
      opts.push(v.slice(0, 40));
    }
  }
  return { ...def, options: opts };
}
