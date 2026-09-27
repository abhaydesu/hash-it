/**
 * Calendar-day helpers in a user's IANA timezone. Days are "YYYY-MM-DD" strings so
 * they compare and sort as text. Pure module — safe on client.
 */

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** The local calendar day of `date` in `timezone`, as YYYY-MM-DD. */
export function localDay(date: Date, timezone: string): string {
  let fmt = dayFormatters.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormatters.set(timezone, fmt);
  }
  return fmt.format(date);
}

/** Shift a YYYY-MM-DD day by whole days (calendar arithmetic, no timezone involved). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the local week containing `date`, as YYYY-MM-DD. */
export function weekStart(date: Date, timezone: string): string {
  const day = localDay(date, timezone);
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

/** Offset of `timezone` from UTC at `instant`, in ms (e.g. +19_800_000 for IST). */
function tzOffsetMs(instant: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The instant local midnight begins on `day` in `timezone`. */
export function startOfLocalDay(day: string, timezone: string): Date {
  const naive = Date.parse(`${day}T00:00:00Z`);
  // Two passes settle the offset across a DST change near midnight.
  let guess = naive - tzOffsetMs(naive, timezone);
  guess = naive - tzOffsetMs(guess, timezone);
  return new Date(guess);
}

/** The instant tomorrow begins, locally. */
export function startOfTomorrow(now: Date, timezone: string): Date {
  return startOfLocalDay(addDays(localDay(now, timezone), 1), timezone);
}

/** "2026-09" → "2026-10" (n months later; negative for earlier). */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** Last calendar day of a YYYY-MM month, as YYYY-MM-DD. */
export function lastDayOfMonth(month: string): string {
  return addDays(`${addMonths(month, 1)}-01`, -1);
}

/** Compact countdown: "6d 21h", "5h 12m", "8m". */
export function formatCountdown(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60_000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
