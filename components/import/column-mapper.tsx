"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  BUILTIN_FIELDS,
  CUSTOM_FIELD_TYPES,
  MAX_CUSTOM_FIELDS,
  fieldIdFromLabel,
  type BuiltinFieldKey,
  type ColumnMapping,
  type CustomFieldDef,
  type CustomFieldType,
} from "@/lib/custom-fields";
import type { CsvInspection } from "@/app/actions/import-actions";

/** What the user picked for one of their columns. */
export type ColumnChoice =
  | { kind: "builtin"; key: BuiltinFieldKey }
  | { kind: "existing"; fieldId: string }
  | { kind: "new"; label: string; type: CustomFieldType; options?: string[] }
  | { kind: "ignore" };

export type ColumnChoices = Record<string, ColumnChoice>;

export const TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Text",
  number: "Number",
  boolean: "Yes / No",
  date: "Date",
  select: "Pick-list",
};

/** Initial choices: take the server's suggestions, keep every unknown column as a new field. */
export function initialChoices(inspection: CsvInspection): ColumnChoices {
  const out: ColumnChoices = {};
  for (const col of inspection.columns) {
    const s = col.suggestion;
    if (s?.kind === "builtin") out[col.header] = { kind: "builtin", key: s.key };
    else if (s?.kind === "custom") out[col.header] = { kind: "existing", fieldId: s.fieldId };
    else if (s?.kind === "ignore" || col.filledCount === 0) out[col.header] = { kind: "ignore" };
    else
      out[col.header] = {
        kind: "new",
        label: col.header.trim().slice(0, 60),
        type: col.inferred.type,
        options: col.inferred.options,
      };
  }
  return out;
}

/** Turn choices into the server mapping plus the custom field defs the import will write. */
export function resolveChoices(
  choices: ColumnChoices,
  existing: CustomFieldDef[]
): { mapping: ColumnMapping; fields: CustomFieldDef[]; errors: string[] } {
  const mapping: ColumnMapping = {};
  const fields: CustomFieldDef[] = [];
  const errors: string[] = [];
  const takenIds = new Set(existing.map((f) => f.id));
  const labels = new Map(existing.map((f) => [f.label.trim().toLowerCase(), f.id]));

  for (const [header, choice] of Object.entries(choices)) {
    if (choice.kind === "builtin") mapping[header] = { kind: "builtin", key: choice.key };
    else if (choice.kind === "ignore") mapping[header] = { kind: "ignore" };
    else if (choice.kind === "existing") {
      const def = existing.find((f) => f.id === choice.fieldId);
      if (def) {
        mapping[header] = { kind: "custom", fieldId: def.id };
        if (!fields.some((f) => f.id === def.id)) fields.push(def);
      }
    } else {
      const label = choice.label.trim();
      if (!label) {
        errors.push(`Give the column "${header}" a field name.`);
        continue;
      }
      if (labels.has(label.toLowerCase())) {
        errors.push(`A field named "${label}" already exists. Map to it or rename.`);
        continue;
      }
      const id = fieldIdFromLabel(label, takenIds);
      takenIds.add(id);
      labels.set(label.toLowerCase(), id);
      const def: CustomFieldDef = {
        id,
        label,
        type: choice.type,
        ...(choice.type === "select" && choice.options?.length ? { options: choice.options } : {}),
      };
      fields.push(def);
      mapping[header] = { kind: "custom", fieldId: id };
    }
  }

  const builtinHeaders = new Map<string, string>();
  for (const [header, t] of Object.entries(mapping)) {
    if (t.kind !== "builtin") continue;
    const prev = builtinHeaders.get(t.key);
    if (prev) errors.push(`"${prev}" and "${header}" both map to the same field. Pick one.`);
    else builtinHeaders.set(t.key, header);
  }

  const mapped = Object.values(mapping);
  if (!mapped.some((t) => t.kind === "builtin" && (t.key === "name" || t.key === "link"))) {
    errors.push("Map one of your columns to Problem name or Problem link.");
  }
  const newCount = fields.filter((f) => !existing.some((e) => e.id === f.id)).length;
  if (existing.length + newCount > MAX_CUSTOM_FIELDS) {
    errors.push(`You can keep up to ${MAX_CUSTOM_FIELDS} custom fields. Ignore a few columns.`);
  }
  return { mapping, fields, errors };
}

function encode(choice: ColumnChoice): string {
  if (choice.kind === "builtin") return `builtin:${choice.key}`;
  if (choice.kind === "existing") return `existing:${choice.fieldId}`;
  return choice.kind;
}

export function ColumnMapper({
  inspection,
  choices,
  onChange,
}: {
  inspection: CsvInspection;
  choices: ColumnChoices;
  onChange: (next: ColumnChoices) => void;
}) {
  const claimedBuiltins = new Map<BuiltinFieldKey, string>();
  for (const [header, c] of Object.entries(choices)) {
    if (c.kind === "builtin" && !claimedBuiltins.has(c.key)) claimedBuiltins.set(c.key, header);
  }

  const set = (header: string, choice: ColumnChoice) => onChange({ ...choices, [header]: choice });

  const pick = (header: string, value: string) => {
    const col = inspection.columns.find((c) => c.header === header)!;
    if (value === "ignore") return set(header, { kind: "ignore" });
    if (value === "new")
      return set(header, {
        kind: "new",
        label: header.trim().slice(0, 60),
        type: col.inferred.type,
        options: col.inferred.options,
      });
    const [kind, id] = value.split(":");
    if (kind === "builtin") set(header, { kind: "builtin", key: id as BuiltinFieldKey });
    else if (kind === "existing") set(header, { kind: "existing", fieldId: id });
  };

  const counts = { matched: 0, fresh: 0, ignored: 0 };
  for (const c of Object.values(choices)) {
    if (c.kind === "new") counts.fresh++;
    else if (c.kind === "ignore") counts.ignored++;
    else counts.matched++;
  }

  return (
    <div className="space-y-3">
      <p className="type-caption tabular-numbers">
        <span className="font-semibold text-foreground">{counts.matched}</span> match our fields ·{" "}
        <span className="font-semibold text-foreground">{counts.fresh}</span> new ·{" "}
        <span className="font-semibold text-foreground">{counts.ignored}</span> ignored
      </p>

      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40">
            <tr className="border-b border-border text-left">
              <th className="type-label px-3 py-2 font-normal">Your column</th>
              <th className="type-label px-3 py-2 font-normal">Sample values</th>
              <th className="type-label px-3 py-2 font-normal">Import as</th>
              <th className="type-label w-24 px-3 py-2 font-normal" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {inspection.columns.map((col) => {
              const choice = choices[col.header] ?? { kind: "ignore" };
              const conflict =
                choice.kind === "builtin" && claimedBuiltins.get(choice.key) !== col.header;
              return (
                <tr key={col.header} className={cn(choice.kind === "ignore" && "text-muted-foreground")}>
                  <td className="px-3 py-2.5 align-top">
                    <div className="font-medium">{col.header}</div>
                    <div className="type-caption tabular-numbers">
                      {col.filledCount}/{inspection.rowCount} filled
                    </div>
                  </td>
                  <td className="max-w-[16rem] px-3 py-2.5 align-top">
                    <div className="truncate font-mono text-xs text-muted-foreground" title={col.samples.join(" · ")}>
                      {col.samples.length ? col.samples.join(" · ") : "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <div className="flex flex-col gap-1.5">
                      <select
                        aria-label={`Import ${col.header} as`}
                        value={encode(choice)}
                        onChange={(e) => pick(col.header, e.target.value)}
                        className="h-8 w-full border border-border bg-background px-2 text-xs"
                      >
                        <optgroup label="Our fields">
                          {BUILTIN_FIELDS.map((f) => {
                            const owner = claimedBuiltins.get(f.key);
                            return (
                              <option key={f.key} value={`builtin:${f.key}`} disabled={!!owner && owner !== col.header}>
                                {f.label}
                                {owner && owner !== col.header ? ` (used by ${owner})` : ""}
                              </option>
                            );
                          })}
                        </optgroup>
                        {inspection.existingFields.length > 0 && (
                          <optgroup label="Your fields">
                            {inspection.existingFields.map((f) => (
                              <option key={f.id} value={`existing:${f.id}`}>
                                {f.label} ({TYPE_LABELS[f.type]})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Other">
                          <option value="new">New field…</option>
                          <option value="ignore">Don&apos;t import</option>
                        </optgroup>
                      </select>

                      {choice.kind === "new" && (
                        <div className="idea-preview flex gap-1.5">
                          <input
                            aria-label={`Field name for ${col.header}`}
                            value={choice.label}
                            maxLength={60}
                            onChange={(e) => set(col.header, { ...choice, label: e.target.value })}
                            className="h-8 min-w-0 flex-1 border border-border bg-background px-2 text-xs"
                            placeholder="Field name"
                          />
                          <select
                            aria-label={`Type for ${col.header}`}
                            value={choice.type}
                            onChange={(e) => {
                              const type = e.target.value as CustomFieldType;
                              set(col.header, {
                                ...choice,
                                type,
                                options:
                                  type === "select"
                                    ? choice.options ?? col.inferred.options ?? col.samples.slice(0, 8)
                                    : undefined,
                              });
                            }}
                            className="h-8 border border-border bg-background px-2 text-xs"
                          >
                            {CUSTOM_FIELD_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {TYPE_LABELS[t]}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {choice.kind === "new" && choice.type === "select" && choice.options?.length ? (
                        <div className="type-caption truncate" title={choice.options.join(", ")}>
                          Options: {choice.options.join(", ")}
                        </div>
                      ) : null}
                      {conflict && (
                        <span className="text-xs text-warning">Another column already feeds this field.</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {choice.kind === "builtin" || choice.kind === "existing" ? (
                      <Badge variant="easy">Matches</Badge>
                    ) : choice.kind === "new" ? (
                      <Badge variant="recall">New</Badge>
                    ) : (
                      <Badge variant="pattern">Ignored</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
