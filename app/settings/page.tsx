"use client";

import { useEffect, useState } from "react";
import { Settings, Save, Sparkles, RefreshCw, CheckCircle2, AlertCircle, Cpu } from "lucide-react";
import { getUserSettings, updateUserSettings, optimizeFSRSParams } from "@/app/actions/settings-actions";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  const [dailyReviewCap, setDailyReviewCap] = useState(5);
  const [desiredRetention, setDesiredRetention] = useState(0.9);
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
        setDailyReviewCap(s.dailyReviewCap);
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
        dailyReviewCap,
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
        <RefreshCw className="h-6 w-6 text-emerald-500 animate-spin" />
        <span className="text-xs text-zinc-500">LOADING_USER_SETTINGS...</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2 font-mono">
          <Settings className="h-4 w-4 text-emerald-400" />
          <h1 className="text-lg font-bold text-zinc-100 uppercase tracking-tight">
            ENGINE_SETTINGS_&_PREFERENCES
          </h1>
        </div>
        <p className="text-xs text-zinc-400 mt-1 font-sans">
          Configure FSRS retention targets, daily review caps, difficulty baselines, and weight parameters.
        </p>
      </div>

      {message && (
        <div
          className={`rounded border p-4 text-xs font-mono flex items-center gap-2 ${
            message.type === "success"
              ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
              : "border-rose-800 bg-rose-950/40 text-rose-300"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6 font-mono text-xs">
        <div className="border border-zinc-800 bg-zinc-950 rounded-lg p-6 space-y-5">
          <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider border-b border-zinc-800/80 pb-2">
            FSRS Schedule Parameters
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Daily Review Cap */}
            <div className="space-y-1.5">
              <label className="text-zinc-400">Daily Review Cap (Cards/day):</label>
              <input
                type="number"
                min="1"
                max="50"
                value={dailyReviewCap}
                onChange={(e) => setDailyReviewCap(parseInt(e.target.value, 10) || 5)}
                className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
              <p className="text-[10px] text-zinc-500 font-sans">Max cards loaded in /today queue</p>
            </div>

            {/* Desired Retention */}
            <div className="space-y-1.5">
              <label className="text-zinc-400">Desired Retention Target (0.7 – 0.95):</label>
              <input
                type="number"
                step="0.01"
                min="0.7"
                max="0.95"
                value={desiredRetention}
                onChange={(e) => setDesiredRetention(parseFloat(e.target.value) || 0.9)}
                className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
              <p className="text-[10px] text-zinc-500 font-sans">FSRS default target is 0.9 (90% retrievability)</p>
            </div>
          </div>

          {/* Timezone */}
          <div className="space-y-1.5 pt-2">
            <label className="text-zinc-400">User Timezone:</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full sm:w-1/2 rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Difficulty Time Baselines */}
        <div className="border border-zinc-800 bg-zinc-950 rounded-lg p-6 space-y-5">
          <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider border-b border-zinc-800/80 pb-2">
            Rating Derivation Baselines (Minutes)
          </h2>
          <p className="text-[11px] text-zinc-400 font-sans">
            Used to derive ratings (Easy / Good / Hard / Again) from time taken to solve cold.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-emerald-400">Easy Baseline (m):</label>
              <input
                type="number"
                min="1"
                value={easyBaseline}
                onChange={(e) => setEasyBaseline(parseInt(e.target.value, 10) || 15)}
                className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-amber-400">Medium Baseline (m):</label>
              <input
                type="number"
                min="1"
                value={mediumBaseline}
                onChange={(e) => setMediumBaseline(parseInt(e.target.value, 10) || 30)}
                className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-rose-400">Hard Baseline (m):</label>
              <input
                type="number"
                min="1"
                value={hardBaseline}
                onChange={(e) => setHardBaseline(parseInt(e.target.value, 10) || 45)}
                className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded border border-emerald-600 bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 font-bold text-zinc-950 transition-colors disabled:opacity-50"
          >
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Settings
          </button>
        </div>
      </form>

      {/* FSRS Optimizer Section */}
      <div className="border border-zinc-800 bg-zinc-950 rounded-lg p-6 space-y-4 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
          <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="h-4 w-4 text-emerald-400" /> FSRS Parameter Optimizer
          </h2>
          <span className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-zinc-400">
            {attemptCount} / 1000 reviews
          </span>
        </div>

        <p className="text-zinc-400 font-sans text-xs">
          Once you log 1,000+ review attempts, you can fit FSRS parameters directly to your personal memory decay curve.
        </p>

        {fsrsParams.length > 0 ? (
          <div className="rounded border border-emerald-900/60 bg-emerald-950/20 p-3 space-y-1">
            <span className="text-emerald-400 font-semibold uppercase text-[10px]">
              Custom FSRS Parameters Active ({fsrsParams.length} weights):
            </span>
            <div className="text-[10px] text-zinc-400 truncate">
              [{fsrsParams.map((n) => n.toFixed(3)).join(", ")}]
            </div>
          </div>
        ) : (
          <div className="text-zinc-500 text-[11px]">
            Default FSRS-6 parameters in use.
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={handleOptimize}
            disabled={optimizing || attemptCount < 1000}
            className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-4 py-2 text-xs text-zinc-200 disabled:opacity-50 transition-colors"
          >
            {optimizing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            )}
            Optimize FSRS Parameters
          </button>
          {attemptCount < 1000 && (
            <p className="text-[10px] text-amber-500/80 mt-1 font-sans">
              Requires 1,000+ logged review attempts to unlock optimization.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
