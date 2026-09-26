"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Pencil } from "lucide-react";
import { updateEntryCustomValues } from "@/app/actions/entry-actions";
import { Button } from "@/components/ui/button";
import { CustomFieldInputs, type CustomDraft } from "@/components/custom-field-inputs";
import { formatCustomValue, type CustomFieldDef, type CustomValues } from "@/lib/custom-fields";

/** "Your fields" on the problem page: read view with an inline editor. */
export function EntryCustomFields({
  entryId,
  fields,
  initialValues,
}: {
  entryId: string;
  fields: CustomFieldDef[];
  initialValues: CustomValues;
}) {
  const [values, setValues] = useState<CustomValues>(initialValues);
  const [draft, setDraft] = useState<CustomDraft | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await updateEntryCustomValues(entryId, draft);
        setValues(res.customValues as CustomValues);
        setDraft(null);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1600);
      } catch (err) {
        setError(String(err));
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-heading text-foreground">Your fields</h2>
        {draft ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={save} disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setDraft({ ...values })}>
            {saved ? (
              <>
                <Check className="icon-pop h-3 w-3 text-easy" /> Saved
              </>
            ) : (
              <>
                <Pencil className="h-3 w-3" /> Edit
              </>
            )}
          </Button>
        )}
      </div>

      {draft ? (
        <div className="idea-preview border border-border p-4">
          <CustomFieldInputs fields={fields} values={draft} onChange={setDraft} />
        </div>
      ) : (
        <dl className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) => {
            const text = formatCustomValue(f, values[f.id]);
            return (
              <div key={f.id} className="bg-background p-3">
                <dt className="type-label">{f.label}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                  {text || <span className="text-muted-foreground">—</span>}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      {error && <p className="text-xs text-warning">{error}</p>}
      <p className="type-caption">
        Manage fields in{" "}
        <Link href="/settings#custom-fields" className="text-orange-600 underline underline-offset-2 hover:text-orange-700">
          Settings
        </Link>
        .
      </p>
    </div>
  );
}
