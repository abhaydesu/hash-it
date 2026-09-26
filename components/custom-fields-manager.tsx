"use client";

import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { getCustomFields, saveCustomFields } from "@/app/actions/settings-actions";
import { Button } from "@/components/ui/button";
import { TYPE_LABELS } from "@/components/import/column-mapper";
import {
  CUSTOM_FIELD_TYPES,
  MAX_CUSTOM_FIELDS,
  MAX_SELECT_OPTIONS,
  fieldIdFromLabel,
  type CustomFieldDef,
  type CustomFieldType,
} from "@/lib/custom-fields";

const inputClass =
  "h-8 border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

/** Settings section: the user's own columns (added via import or here). */
export function CustomFieldsManager() {
  const [saved, setSaved] = useState<CustomFieldDef[] | null>(null);
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<CustomFieldType>("text");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCustomFields()
      .then((defs) => {
        setSaved(defs);
        setFields(defs);
      })
      .catch((err) => setError(String(err)));
  }, []);

  const savedIds = new Set(saved?.map((f) => f.id));
  const dirty = saved !== null && JSON.stringify(saved) !== JSON.stringify(fields);

  const update = (i: number, patch: Partial<CustomFieldDef>) =>
    setFields((prev) => prev.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: -1 | 1) =>
    setFields((prev) => {
      const next = [...prev];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    if (fields.some((f) => f.label.toLowerCase() === label.toLowerCase())) {
      setError(`A field named "${label}" already exists.`);
      return;
    }
    const id = fieldIdFromLabel(label, [...fields.map((f) => f.id), ...(saved ?? []).map((f) => f.id)]);
    setFields((prev) => [...prev, { id, label, type: newType, ...(newType === "select" ? { options: [] } : {}) }]);
    setNewLabel("");
    setError(null);
  };

  const save = async () => {
    setStatus("saving");
    setError(null);
    try {
      const cleaned = fields.map((f) => ({ ...f, label: f.label.trim() }));
      const result = await saveCustomFields(cleaned);
      setSaved(result);
      setFields(result);
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1600);
    } catch (err) {
      setError(String(err).replace(/^Error:\s*/, ""));
      setStatus("idle");
    }
  };

  if (saved === null && !error) {
    return <p className="type-caption">Loading fields…</p>;
  }

  return (
    <div className="space-y-4">
      {fields.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-6 text-center type-caption">
          No custom fields yet. Import a sheet with your own columns, or add one below.
        </p>
      ) : (
        <ul className="divide-y divide-border border border-border">
          {fields.map((f, i) => (
            <li key={f.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
              <input
                aria-label="Field name"
                value={f.label}
                maxLength={60}
                onChange={(e) => update(i, { label: e.target.value })}
                className={`${inputClass} min-w-0 flex-1`}
              />
              <span className="type-label w-20 shrink-0" title={savedIds.has(f.id) ? "Type is fixed once saved" : undefined}>
                {TYPE_LABELS[f.type]}
              </span>
              {f.type === "select" && (
                <input
                  aria-label={`${f.label} options`}
                  defaultValue={(f.options ?? []).join(", ")}
                  onBlur={(e) =>
                    update(i, {
                      options: [
                        ...new Set(
                          e.target.value
                            .split(",")
                            .map((o) => o.trim().slice(0, 40))
                            .filter(Boolean)
                        ),
                      ].slice(0, MAX_SELECT_OPTIONS),
                    })
                  }
                  placeholder="Options, comma separated"
                  className={`${inputClass} min-w-0 flex-1`}
                />
              )}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={`Move ${f.label} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="pressable p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${f.label} down`}
                  disabled={i === fields.length - 1}
                  onClick={() => move(i, 1)}
                  className="pressable p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${f.label}`}
                  onClick={() => setFields((prev) => prev.filter((_, j) => j !== i))}
                  className="pressable p-1.5 text-muted-foreground hover:bg-hard/10 hover:text-hard"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {fields.length < MAX_CUSTOM_FIELDS && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            aria-label="New field name"
            value={newLabel}
            maxLength={60}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="New field, e.g. Company"
            className={`${inputClass} min-w-0 flex-1`}
          />
          <select
            aria-label="New field type"
            value={newType}
            onChange={(e) => setNewType(e.target.value as CustomFieldType)}
            className={inputClass}
          >
            {CUSTOM_FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <Button type="button" variant="secondary" size="sm" onClick={add} disabled={!newLabel.trim()}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <p className="type-caption">
          Deleting a field hides it; values already saved on problems are kept.
        </p>
        <Button type="button" variant="primary" size="sm" onClick={save} disabled={!dirty || status === "saving"}>
          {status === "saved" ? (
            <>
              <Check className="icon-pop h-3.5 w-3.5" /> Saved
            </>
          ) : status === "saving" ? (
            "Saving…"
          ) : (
            "Save fields"
          )}
        </Button>
      </div>
      {error && <p className="text-xs text-warning">{error}</p>}
    </div>
  );
}
