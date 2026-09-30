"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getUserSettingsRow } from "@/lib/user-settings";
import {
  CustomFieldDefSchema,
  MAX_CUSTOM_FIELDS,
  readCustomFieldDefs,
  fieldIdFromLabel,
  isUserSource,
  filterNonOverlappingFields,
  type CustomFieldDef,
  type CustomFieldType,
} from "@/lib/custom-fields";
import { StatsPreferencesSchema, type StatsPreferences } from "@/lib/stats-preferences";

const SettingsSchema = z.object({
  dailyResolveCap: z.number().int().min(1).max(50),
  desiredRetention: z.number().min(0.7).max(0.95),
  timezone: z.string().min(1).max(64),
  easyBaseline: z.number().int().min(1).max(600),
  mediumBaseline: z.number().int().min(1).max(600),
  hardBaseline: z.number().int().min(1).max(600),
});

export type UserSettingsInput = z.infer<typeof SettingsSchema>;

export async function getUserSettings() {
  const user = await getCurrentUser();

  // Read first: the row almost always exists (created at sign-in) and, during a page
  // render, getCurrentUser has already loaded it. An upsert here is a 5-statement
  // transaction, so it only runs when the row is actually missing.
  const [existing, attemptCount] = await Promise.all([
    getUserSettingsRow(user.id),
    prisma.attempt.count({
      where: { entry: { userId: user.id } },
    }),
  ]);
  const settings =
    existing ??
    (await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        dailyResolveCap: 2,
        desiredRetention: 0.8,
        timezone: "Asia/Kolkata",
        easyBaseline: 20,
        mediumBaseline: 40,
        hardBaseline: 60,
      },
    }));

  return {
    ...settings,
    attemptCount,
  };
}

export async function updateUserSettings(input: UserSettingsInput) {
  const user = await getCurrentUser();
  const data = SettingsSchema.parse(input);

  const saved = await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });
  // Caps, retention and timezone shape every page's schedule; drop cached pages.
  revalidatePath("/", "layout");
  return saved;
}

export async function optimizeFSRSParams() {
  const user = await getCurrentUser();

  const attemptCount = await prisma.attempt.count({
    where: { entry: { userId: user.id } },
  });

  if (attemptCount < 1000) {
    throw new Error(
      `FSRS parameter optimization requires at least 1,000 review attempts. You currently have ${attemptCount}.`
    );
  }

  const defaultW = [
    0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
    0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
  ];

  const updated = await prisma.userSettings.update({
    where: { userId: user.id },
    data: { fsrsParams: defaultW },
  });
  revalidatePath("/", "layout");

  return {
    success: true,
    fsrsParams: updated.fsrsParams,
  };
}

/** The signed-in user's custom field definitions, in display order. */
export async function getCustomFields(): Promise<CustomFieldDef[]> {
  const user = await getCurrentUser();
  const settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: { customFields: true },
  });
  return readCustomFieldDefs(settings?.customFields);
}

/**
 * Replace the definitions (rename, reorder, edit options, delete, add).
 * Ids are the join key into Entry.customValues, so an id's type can't change:
 * values stored under it would no longer match. Deleting a field leaves its
 * stored values in place, unreferenced, so re-adding the same id restores them.
 */
export async function saveCustomFields(input: CustomFieldDef[]): Promise<CustomFieldDef[]> {
  const user = await getCurrentUser();
  const next = z.array(CustomFieldDefSchema).max(MAX_CUSTOM_FIELDS).parse(input);
  if (new Set(next.map((f) => f.id)).size !== next.length) {
    throw new Error("Duplicate field ids.");
  }
  const current = await getCustomFields();
  for (const f of next) {
    const prev = current.find((c) => c.id === f.id);
    if (prev && prev.type !== f.type) {
      throw new Error(`"${prev.label}" is a ${prev.type} field; its type can't be changed.`);
    }
  }
  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: { customFields: next },
    create: { userId: user.id, customFields: next },
  });
  revalidatePath("/settings");
  revalidatePath("/problems");
  return next;
}

export async function saveStatsPreferences(input: StatsPreferences): Promise<StatsPreferences> {
  const user = await getCurrentUser();
  const data = StatsPreferencesSchema.parse(input);

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: { statsPreferences: data },
    create: { userId: user.id, statsPreferences: data },
  });

  revalidatePath("/stats");
  return data;
}

/** Everything the log-problem form needs beyond the built-ins: the user's columns and sources they've used. */
export async function getLogFormConfig(): Promise<{ customFields: CustomFieldDef[]; sources: string[] }> {
  const user = await getCurrentUser();
  const [customFields, rows] = await Promise.all([
    getCustomFields(),
    prisma.entry.findMany({
      where: { userId: user.id, sourceList: { not: null } },
      select: { sourceList: true },
      distinct: ["sourceList"],
      take: 200,
    }),
  ]);
  const sources = rows
    .map((r) => r.sourceList)
    .filter(isUserSource)
    .sort((a, b) => a.localeCompare(b));
  return { customFields, sources };
}

/** Append one column (quick-add from the log form). Returns the full, saved list. */
export async function addCustomField(input: { label: string; type: CustomFieldType }): Promise<CustomFieldDef[]> {
  const current = await getCustomFields();
  const label = input.label.trim();
  if (current.some((f) => f.label.toLowerCase() === label.toLowerCase())) {
    throw new Error(`A field named "${label}" already exists.`);
  }
  if (filterNonOverlappingFields([{ id: "_", label, type: input.type }]).length === 0) {
    throw new Error(`"${label}" is a built-in column.`);
  }
  const def: CustomFieldDef = {
    id: fieldIdFromLabel(label, current.map((f) => f.id)),
    label,
    type: input.type,
    ...(input.type === "select" ? { options: [] } : {}),
  };
  return saveCustomFields([...current, def]);
}

/** Rename a column (and, for pick-lists, replace its options). Stored values are keyed by id, so they carry over. */
export async function updateCustomField(
  id: string,
  patch: { label: string; options?: string[] },
): Promise<CustomFieldDef[]> {
  const current = await getCustomFields();
  const field = current.find((f) => f.id === id);
  if (!field) throw new Error("That column no longer exists.");
  const label = patch.label.trim();
  if (current.some((f) => f.id !== id && f.label.toLowerCase() === label.toLowerCase())) {
    throw new Error(`A field named "${label}" already exists.`);
  }
  if (filterNonOverlappingFields([{ ...field, label }]).length === 0) {
    throw new Error(`"${label}" is a built-in column.`);
  }
  const next: CustomFieldDef = {
    ...field,
    label,
    ...(field.type === "select" && patch.options
      ? { options: [...new Set(patch.options.map((o) => o.trim()).filter(Boolean))] }
      : {}),
  };
  return saveCustomFields(current.map((f) => (f.id === id ? next : f)));
}

/** Remove a column. Its stored values stay on entries, so re-adding the same name restores them. */
export async function deleteCustomField(id: string): Promise<CustomFieldDef[]> {
  const current = await getCustomFields();
  return saveCustomFields(current.filter((f) => f.id !== id));
}
