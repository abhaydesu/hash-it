"use client";
import React from 'react';

import { useEffect, useState } from "react";
import { Save, Sparkles, CheckCircle2, AlertCircle, Cpu } from "lucide-react";
import { getUserSettings, updateUserSettings, optimizeFSRSParams } from "@/app/actions/settings-actions";
import { SheetSection } from "@/components/ui/sheet-section";
import { PageSkeleton } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  const [dailyResolveCap, setDailyResolveCap] = useState(2);
  const [desiredRetention, setDesiredRetention] = useState(0.8);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [easyBaseline, setEasyBaseline] = useState(20);
  const [mediumBaseline, setMediumBaseline] = useState(40);
  const [hardBaseline, setHardBaseline] = useState(60);
  const [fsrsParams, setFsrsParams] = useState<number[]>([]);
  const [attemptCount, setAttemptCount] = useState(0);

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const s = await getUserSettings();
        setDailyResolveCap(s.dailyResolveCap);
        setDesiredRetention(s.desiredRetention);
        setTimezone(s.timezone);
        setEasyBaseline(s.easyBaseline);
        setMediumBaseline(s.mediumBaseline);
        setHardBaseline(s.hardBaseline);
        setFsrsParams(s.fsrsParams || []);
        setAttemptCount(s.attemptCount || 0);
      } catch (err) {
        console.error("Failed to load settings", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateUserSettings({
        dailyResolveCap,
        desiredRetention,
        timezone,
        easyBaseline,
        mediumBaseline,
        hardBaseline,
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

  if (loading) {
    return (
      <div className="max-w-4xl animate-pulse">
        <SheetSection innerClassName="py-6">
          <div className="h-7 w-32 bg-muted rounded"></div>
          <div className="mt-2 h-4 w-96 bg-muted rounded"></div>
        </SheetSection>

        <SheetSection innerClassName="space-y-6 py-6">
          <div className="space-y-5 border border-border bg-background p-6">
            <div className="h-6 w-48 bg-muted rounded border-b border-border pb-2"></div>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-32 bg-muted rounded"></div>
                  <div className="h-10 w-full bg-muted/40 border border-border"></div>
                </div>
              ))}
            </div>
          </div>
        </SheetSection>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <SheetSection innerClassName="py-6">
        <h1 className="type-title text-foreground">Settings</h1>
        <p className="mt-1 type-caption">
          Retention targets, review caps, and scheduling weights.
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
                <label className="type-label block">Daily review cap (cards/day)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={dailyResolveCap}
                  onChange={(e) => setDailyResolveCap(parseInt(e.target.value, 10) || 2)}
                  className={inputClass}
                />
                <p className="type-caption">Max cards loaded in /today queue</p>
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
