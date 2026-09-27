/**
 * Per-user layout of the configurable /stats sections. Pure module — safe on client.
 *
 * `visibleSections` is ordered (display order); `hiddenSections` is a set.
 * Sections in neither list (e.g. a newly added custom field) show by default.
 */
import { z } from "zod";

export const StatsPreferencesSchema = z.object({
  visibleSections: z.array(z.string().max(80)).max(100),
  hiddenSections: z.array(z.string().max(80)).max(100),
});
export type StatsPreferences = z.infer<typeof StatsPreferencesSchema>;

export const DEFAULT_STATS_PREFERENCES: StatsPreferences = { visibleSections: [], hiddenSections: [] };

export function readStatsPreferences(raw: unknown): StatsPreferences {
  const parsed = StatsPreferencesSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_STATS_PREFERENCES;
}

/** Resolve saved preferences against the sections that actually exist right now. */
export function resolveSectionLayout(
  availableIds: string[],
  prefs: StatsPreferences,
): Array<{ id: string; visible: boolean }> {
  const available = new Set(availableIds);
  const hidden = new Set(prefs.hiddenSections);
  const ordered = [...new Set(prefs.visibleSections)].filter((id) => available.has(id) && !hidden.has(id));
  const placed = new Set(ordered);
  const unseen = availableIds.filter((id) => !placed.has(id) && !hidden.has(id));

  return [
    ...ordered.map((id) => ({ id, visible: true })),
    ...unseen.map((id) => ({ id, visible: true })),
    ...availableIds.filter((id) => hidden.has(id)).map((id) => ({ id, visible: false })),
  ];
}
