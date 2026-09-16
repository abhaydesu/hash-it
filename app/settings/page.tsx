"use client";

import { useEffect, useState } from "react";
import { Settings, Save, Sparkles, RefreshCw, CheckCircle2, AlertCircle, Cpu } from "lucide-react";
import { getUserSettings, updateUserSettings, optimizeFSRSParams } from "@/app/actions/settings-actions";
import { SheetSection } from "@/components/ui/sheet-section";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  const [dailyResolveCap, setDailyResolveCap] = useState(2);
  const [desiredRetention, setDesiredRetention] = useState(0.80);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [easyBaseline, setEasyBaseline] = useState(15);
  const [mediumBaseline, setMediumBaseline] = useState(30);
  const [hardBaseline, setHardBaseline] = useState(45);
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
      setMessage({ type: "success", text: "FSRS weights optimized and applied to scheduler!" });
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setOptimizing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3 font-mono">
        <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
        <span className="text-xs text-muted-foreground  tracking-wider">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl pb-12">
      {/* Header */}
      <SheetSection innerClassName="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between py-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure FSRS retention targets, daily review caps, difficulty baselines, and weight parameters.
          </p>
        </div>
      </SheetSection>

      {/* Main Settings Form */}
      <SheetSection innerClassName="py-6 font-mono text-xs">
      {message && (
        <div
          className={`border p-4 text-xs font-mono flex items-center gap-2 mb-6 ${
            message.type === "success"
              ? "border-easy bg-easy/10 text-easy"
              : "border-destructive bg-destructive/10 text-destructive"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span className=" tracking-wider">{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="border border-border bg-background p-6 space-y-5">
          <h2 className="text-[11px] font-semibold text-muted-foreground  tracking-wider border-b border-border pb-2">
            FSRS schedule parameters
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Daily Review Cap */}
            <div className="space-y-1.5">
              <label className="text-muted-foreground  tracking-wider text-[10px] font-semibold block">Daily Review Cap (Cards/day)</label>
              <input
                type="number"
                min="1"
                max="50"
                value={dailyResolveCap}
                onChange={(e) => setDailyResolveCap(parseInt(e.target.value, 10) || 2)}
                className="w-full border border-border bg-background px-3 py-2 text-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors"
              />
              <p className="text-[10px] text-muted-foreground font-sans">Max cards loaded in /today queue</p>
            </div>

            {/* Desired Retention */}
            <div className="space-y-1.5">
              <label className="text-muted-foreground  tracking-wider text-[10px] font-semibold block">Desired Retention Target (0.7 – 0.95)</label>
              <input
                type="number"
                step="0.01"
                min="0.7"
                max="0.95"
                value={desiredRetention}
                onChange={(e) => setDesiredRetention(parseFloat(e.target.value) || 0.80)}
                className="w-full border border-border bg-background px-3 py-2 text-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors"
              />
              <p className="text-[10px] text-muted-foreground font-sans">Lower retention means longer gaps and fewer reviews per day, at the cost of forgetting a little more — appropriate when each review costs minutes rather than seconds.</p>
            </div>
          </div>

          {/* Timezone */}
          <div className="space-y-1.5 pt-2">
            <label className="text-muted-foreground  tracking-wider text-[10px] font-semibold block">User Timezone</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full sm:w-1/2 border border-border bg-background px-3 py-2 text-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors"
            />
          </div>
        </div>

        {/* Difficulty Time Baselines */}
        <div className="border border-border bg-background p-6 space-y-5">
          <div className="border-b border-border pb-2 flex items-baseline justify-between">
            <h2 className="text-[11px] font-semibold text-muted-foreground  tracking-wider">
              Rating derivation baselines (Minutes)
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground font-sans">
            Used to derive ratings (Easy / Good / Hard / Again) from time taken to solve cold.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-easy  tracking-wider text-[10px] font-semibold block">Easy Baseline (m)</label>
              <input
                type="number"
                min="1"
                value={easyBaseline}
                onChange={(e) => setEasyBaseline(parseInt(e.target.value, 10) || 15)}
                className="w-full border border-easy/50 bg-background px-3 py-2 text-foreground focus:border-easy focus:outline-none focus:ring-1 focus:ring-easy transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-medium  tracking-wider text-[10px] font-semibold block">Medium Baseline (m)</label>
              <input
                type="number"
                min="1"
                value={mediumBaseline}
                onChange={(e) => setMediumBaseline(parseInt(e.target.value, 10) || 30)}
                className="w-full border border-medium/50 bg-background px-3 py-2 text-foreground focus:border-medium focus:outline-none focus:ring-1 focus:ring-medium transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-hard  tracking-wider text-[10px] font-semibold block">Hard Baseline (m)</label>
              <input
                type="number"
                min="1"
                value={hardBaseline}
                onChange={(e) => setHardBaseline(parseInt(e.target.value, 10) || 45)}
                className="w-full border border-hard/50 bg-background px-3 py-2 text-foreground focus:border-hard focus:outline-none focus:ring-1 focus:ring-hard transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 border border-border bg-foreground text-background hover:bg-foreground/90 px-6 py-2.5 font-bold  tracking-wide transition-colors disabled:opacity-50"
          >
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Settings
          </button>
        </div>
      </form>
      </SheetSection>

      {/* FSRS Optimizer Section */}
      <SheetSection innerClassName="py-6 font-mono text-xs">
        <div className="border border-border bg-background p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-[11px] font-semibold text-muted-foreground  tracking-wider flex items-center gap-2">
            <Cpu className="h-4 w-4" /> FSRS Parameter Optimizer
          </h2>
          <span className="border border-border bg-muted/20 px-2 py-0.5 text-[10px] text-muted-foreground">
            {attemptCount} / 1000 reviews
          </span>
        </div>

        <p className="text-muted-foreground font-sans text-xs">
          Once you log 1,000+ review attempts, you can fit FSRS parameters directly to your personal memory decay curve.
        </p>

        {fsrsParams.length > 0 ? (
          <div className="border border-foreground bg-foreground/5 p-3 space-y-1">
            <span className="text-foreground font-semibold  tracking-wider text-[10px]">
              Custom FSRS parameters active ({fsrsParams.length} weights):
            </span>
            <div className="text-[10px] text-muted-foreground truncate">
              [{fsrsParams.map((n) => n.toFixed(3)).join(", ")}]
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground text-[11px]">
            Default FSRS-6 parameters in use.
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={handleOptimize}
            disabled={optimizing || attemptCount < 1000}
            className="flex items-center gap-2 border border-border bg-background hover:bg-muted px-4 py-2 text-xs font-semibold  tracking-wide text-foreground disabled:opacity-50 transition-colors"
          >
            {optimizing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Optimize FSRS Parameters
          </button>
          {attemptCount < 1000 && (
            <p className="text-[10px] text-warning mt-1.5 font-sans">
              Requires 1,000+ logged review attempts to unlock optimization.
            </p>
          )}
        </div>
        </div>
      </SheetSection>
    </div>
  );
}
