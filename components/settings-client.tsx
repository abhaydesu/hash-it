"use client";
import React from 'react';

import { useState } from "react";
import Link from "next/link";
import { Save, Sparkles, CheckCircle2, AlertCircle, Cpu, Columns3, FileUp } from "lucide-react";
import { CustomFieldsManager } from "@/components/custom-fields-manager";
import { updateUserSettings, optimizeFSRSParams } from "@/app/actions/settings-actions";
import type { getUserSettings } from "@/app/actions/settings-actions";
import { SheetSection } from "@/components/ui/sheet-section";
import { Button } from "@/components/ui/button";
import type { CustomFieldDef } from "@/lib/custom-fields";

export type InitialSettings = Pick<
  Awaited<ReturnType<typeof getUserSettings>>,
  "dailyResolveCap" | "dailyRecallCap" | "minDailyResolve" | "desiredRetention" | "timezone" | "easyBaseline" | "mediumBaseline" | "hardBaseline" | "fsrsParams" | "attemptCount" | "firstIntervalCold" | "firstIntervalHint" | "firstIntervalSolution" | "firstIntervalFlagged"
>;

/** Settings form. Data arrives with the server render, so there's no client-side load step. */
export function SettingsClient({
  initial,
  initialCustomFields,
}: {
  initial: InitialSettings;
  initialCustomFields?: CustomFieldDef[];
}) {
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  const [dailyResolveCap, setDailyResolveCap] = useState(initial.dailyResolveCap);
  const [dailyRecallCap, setDailyRecallCap] = useState(initial.dailyRecallCap);
  const [minDailyResolve, setMinDailyResolve] = useState(initial.minDailyResolve);
  const [desiredRetention, setDesiredRetention] = useState(initial.desiredRetention);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [easyBaseline, setEasyBaseline] = useState(initial.easyBaseline);
  const [mediumBaseline, setMediumBaseline] = useState(initial.mediumBaseline);
  const [hardBaseline, setHardBaseline] = useState(initial.hardBaseline);
  const [firstIntervalCold, setFirstIntervalCold] = useState(initial.firstIntervalCold);
  const [firstIntervalHint, setFirstIntervalHint] = useState(initial.firstIntervalHint);
  const [firstIntervalSolution, setFirstIntervalSolution] = useState(initial.firstIntervalSolution);
  const [firstIntervalFlagged, setFirstIntervalFlagged] = useState(initial.firstIntervalFlagged);
  const [fsrsParams, setFsrsParams] = useState<number[]>(initial.fsrsParams || []);
  const attemptCount = initial.attemptCount || 0;

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateUserSettings({
        dailyResolveCap,
        dailyRecallCap,
        minDailyResolve,
        desiredRetention,
        timezone,
        easyBaseline,
        mediumBaseline,
        hardBaseline,
        firstIntervalCold,
        firstIntervalHint,
        firstIntervalSolution,
        firstIntervalFlagged,
      });
      setMessage({ type: "success", text: "Settings saved successfully." });
    } catch (err) {
      setMessage({ type: "error", text: String(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    setMessage(null);
    try {
      const res = await optimizeFSRSParams();
      setFsrsParams(res.fsrsParams);
      setMessage({
        type: "success",
        text: "FSRS weights optimized and applied to scheduler!",
      });
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setOptimizing(false);
    }
  };

  const inputClass =
    "w-full border border-border bg-background px-3 py-2 text-sm text-foreground tabular-nums transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500";

  return (
    <div>
      <SheetSection innerClassName="py-6">
        <h1 className="type-title text-foreground">Settings</h1>
        <p className="mt-1 type-caption">
          Choose how many reviews you get each day and how soon problems come back.
        </p>
      </SheetSection>

      <SheetSection innerClassName="space-y-6 py-6">
        {message && (
          <div
            className={`flex items-center gap-2 border p-4 text-xs ${
              message.type === "success"
                ? "border-easy bg-easy/10 text-easy"
                : "border-destructive bg-destructive/10 text-destructive"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-5 border border-border bg-background p-6">
            <h2 className="type-heading border-b border-border pb-2 text-foreground">
              FSRS schedule parameters
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="type-label block">Full re-solves per day</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={dailyResolveCap}
                  onChange={(e) => setDailyResolveCap(parseInt(e.target.value, 10) || 2)}
                  className={inputClass}
                />
                <p className="type-caption">How many problems a day to re-solve from scratch. Each one costs the better part of half an hour.</p>
              </div>

              <div className="space-y-1.5">
                <label className="type-label block">Minimum re-solves per day</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={minDailyResolve}
                  onChange={(e) => setMinDailyResolve(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className={inputClass}
                />
                <p className="type-caption">
                  If fewer problems need a re-solve on their own, the queue adds due problems you never solved without help, up to this many. Set 0 to turn it off.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="type-label block">Recall checks per day</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={dailyRecallCap}
                  onChange={(e) => setDailyRecallCap(parseInt(e.target.value, 10) || 5)}
                  className={inputClass}
                />
                <p className="type-caption">How many quick approach checks a day. These take two or three minutes each, so this can be generous.</p>
              </div>

              <div className="space-y-1.5">
                <label className="type-label block">Desired retention target (0.7 – 0.95)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.7"
                  max="0.95"
                  value={desiredRetention}
                  onChange={(e) => setDesiredRetention(parseFloat(e.target.value) || 0.8)}
                  className={inputClass}
                />
                <p className="type-caption">
                  Lower retention means longer gaps and fewer reviews per day, at the cost of
                  forgetting a little more — appropriate when each review costs minutes rather than
                  seconds.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <p className="type-caption">
                How long a newly logged problem waits before its first review, set by how the solve went — longer
                waits mean fewer reviews competing with new problems, and changing these does not move problems
                already logged.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ["Solved cold", firstIntervalCold, setFirstIntervalCold],
                    ["Used hint", firstIntervalHint, setFirstIntervalHint],
                    ["Saw solution", firstIntervalSolution, setFirstIntervalSolution],
                    ["Flagged", firstIntervalFlagged, setFirstIntervalFlagged],
                  ] as const
                ).map(([label, value, setValue]) => (
                  <div key={label} className="space-y-1.5">
                    <label className="type-label block">{label}</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={value}
                      onChange={(e) => setValue(parseInt(e.target.value, 10) || 1)}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="type-label block">User timezone</label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className={`${inputClass} sm:w-1/2`}
              />
            </div>
          </div>

          <div className="space-y-5 border border-border bg-background p-6">
            <h2 className="type-heading border-b border-border pb-2 text-foreground">
              Rating derivation baselines (minutes)
            </h2>
            <p className="type-caption">
              Used to derive ratings (Easy / Good / Hard / Again) from time taken to solve cold.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="type-label block text-easy">Easy baseline (m)</label>
                <input
                  type="number"
                  min="1"
                  value={easyBaseline}
                  onChange={(e) => setEasyBaseline(parseInt(e.target.value, 10) || 15)}
                  className={`${inputClass} border-easy/50 focus:border-easy focus:ring-easy`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="type-label block text-medium">Medium baseline (m)</label>
                <input
                  type="number"
                  min="1"
                  value={mediumBaseline}
                  onChange={(e) => setMediumBaseline(parseInt(e.target.value, 10) || 30)}
                  className={`${inputClass} border-medium/50 focus:border-medium focus:ring-medium`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="type-label block text-hard">Hard baseline (m)</label>
                <input
                  type="number"
                  min="1"
                  value={hardBaseline}
                  onChange={(e) => setHardBaseline(parseInt(e.target.value, 10) || 45)}
                  className={`${inputClass} border-hard/50 focus:border-hard focus:ring-hard`}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={saving}>
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </form>
      </SheetSection>

      <SheetSection innerClassName="space-y-4 py-6">
        <div id="import" className="scroll-mt-28 space-y-1 border-b border-border pb-2">
          <h2 className="flex items-center gap-2 type-heading text-foreground">
            <FileUp className="h-4 w-4" /> Import problems
          </h2>
          <p className="type-caption">
            Add problems you&apos;ve already solved, from a LeetCode screenshot or your own spreadsheet.
            Due dates are spread out so your queue doesn&apos;t flood.
          </p>
        </div>
        <Link
          href="/import"
          className="pressable inline-flex h-8 items-center border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted"
        >
          Start an import
        </Link>
      </SheetSection>

      <SheetSection innerClassName="space-y-4 py-6">
        <div id="custom-fields" className="scroll-mt-28 space-y-1 border-b border-border pb-2">
          <h2 className="flex items-center gap-2 type-heading text-foreground">
            <Columns3 className="h-4 w-4" /> Your fields
          </h2>
          <p className="type-caption">
            Columns you track beyond ours. They show up when you log a problem and on each problem page.
            Scheduling never reads them.
          </p>
        </div>
        <CustomFieldsManager initialFields={initialCustomFields} />
      </SheetSection>

      <SheetSection innerClassName="space-y-4 py-6" last>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
          <h2 className="flex items-center gap-2 type-heading text-foreground">
            <Cpu className="h-4 w-4" /> FSRS parameter optimizer
          </h2>
          <span className="border border-border bg-muted/20 px-2 py-0.5 type-caption tabular-nums">
            {attemptCount} / 1000 reviews
          </span>
        </div>

        <p className="type-caption">
          Once you log 1,000+ review attempts, you can fit FSRS parameters directly to your personal
          memory decay curve.
        </p>

        {fsrsParams.length > 0 ? (
          <div className="space-y-1 border border-border bg-muted/20 p-3">
            <span className="type-label text-foreground">
              Custom FSRS parameters active ({fsrsParams.length} weights)
            </span>
            <div className="truncate font-mono text-[10px] text-muted-foreground">
              [{fsrsParams.map((n) => n.toFixed(3)).join(", ")}]
            </div>
          </div>
        ) : (
          <div className="type-caption">Default FSRS-6 parameters in use.</div>
        )}

        <div className="pt-2">
          <Button
            variant="secondary"
            onClick={handleOptimize}
            disabled={optimizing || attemptCount < 1000}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {optimizing ? "Optimizing…" : "Optimize FSRS parameters"}
          </Button>
          {attemptCount < 1000 && (
            <p className="mt-1.5 type-caption text-warning">
              Requires 1,000+ logged review attempts to unlock optimization.
            </p>
          )}
        </div>
      </SheetSection>
    </div>
  );
}
