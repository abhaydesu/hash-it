import { localDay } from "@/lib/dates";

type Greeter = (name?: string) => string;

const say =
  (lead: string, punct = ""): Greeter =>
  (name) =>
    name ? `${lead}, ${name}${punct}` : `${lead}${punct}`;

/** Greeting pools by local hour. One is picked per day, so it doesn't flicker on refresh. */
const POOLS: Array<{ from: number; to: number; greeters: Greeter[] }> = [
  { from: 0, to: 4, greeters: [say("Burning the midnight oil", "?"), say("Still up", "?"), say("Late night session")] },
  { from: 5, to: 7, greeters: [say("Up early"), say("Early bird"), say("Good morning")] },
  { from: 8, to: 11, greeters: [say("Good morning"), say("Morning"), say("Rise and shine")] },
  { from: 12, to: 16, greeters: [say("Good afternoon"), say("Afternoon"), say("Hey there")] },
  { from: 17, to: 20, greeters: [say("Good evening"), say("Evening"), say("Welcome back")] },
  { from: 21, to: 23, greeters: [say("Good evening"), say("Winding down", "?"), say("Late one")] },
];

function localHour(now: Date, timezone: string): number {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(now)
  );
  return Number.isFinite(hour) ? hour % 24 : 12;
}

/** First word of a display name, or undefined when there isn't one. */
export function firstName(name: string | null | undefined): string | undefined {
  const first = name?.trim().split(/\s+/)[0];
  return first || undefined;
}

/** Time-of-day greeting in the user's timezone, e.g. "Good evening, Abhay". */
export function getGreeting({
  now,
  timezone,
  name,
}: {
  now: Date;
  timezone: string;
  name?: string | null;
}): string {
  const hour = localHour(now, timezone);
  const pool = POOLS.find((p) => hour >= p.from && hour <= p.to) ?? POOLS[2];
  const day = localDay(now, timezone);
  let seed = 0;
  for (const ch of day) seed += ch.charCodeAt(0);
  return pool.greeters[seed % pool.greeters.length](firstName(name));
}
