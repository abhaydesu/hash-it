"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Check, Camera, Bot, Upload, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildLeetcodePrompt, CSV_HEADER } from "@/lib/leetcode-import-prompt";
import { cn } from "@/lib/utils";

export function LeetcodeImportGuide() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"prompt" | "header" | null>(null);

  const prompt = buildLeetcodePrompt();

  const copy = async (text: string, key: "prompt" | "header") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((prev) => (prev === key ? null : prev)), 1600);
    } catch {
      // clipboard blocked — fall back silently; textarea still lets user select+copy manually.
    }
  };

  return (
    <div className="border border-border bg-background">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-5 w-5 items-center justify-center border border-border bg-muted text-muted-foreground">
            <Bot className="h-3 w-3" />
          </span>
          <div>
            <span className="block text-xs font-medium text-foreground">
              Coming from LeetCode? Turn screenshots into a CSV with any LLM.
            </span>
            <span className="type-caption">
              Screenshot your <span className="font-mono">/progress</span> page, run the prompt below through Claude / GPT / Gemini, upload the result.
            </span>
          </div>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="space-y-5 border-t border-border p-5">
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Step
              n={1}
              icon={<Camera className="h-3.5 w-3.5" />}
              title="Screenshot /progress"
              body="On leetcode.com/progress, capture your solved list. Multiple screenshots are fine — scroll and shoot until every solved row is covered."
            />
            <Step
              n={2}
              icon={<Bot className="h-3.5 w-3.5" />}
              title="Run the prompt"
              body="Open Claude / ChatGPT / Gemini, paste the prompt below, attach your screenshots. The reply is plain CSV text — copy it, or save it as a .csv file."
            />
            <Step
              n={3}
              icon={<Upload className="h-3.5 w-3.5" />}
              title="Upload or paste"
              body="In step 1 above, either upload the .csv file or switch to the paste tab and drop the CSV text in. Then run the dry-run and pick a status mode."
            />
          </ol>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="type-label text-foreground">LLM prompt (patterns embedded)</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copy(prompt, "prompt")}
                aria-label="Copy prompt to clipboard"
              >
                {copied === "prompt" ? (
                  <>
                    <Check className="mr-1.5 h-3 w-3 text-easy" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-3 w-3" />
                    Copy prompt
                  </>
                )}
              </Button>
            </div>
            <textarea
              readOnly
              value={prompt}
              rows={12}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full resize-y border border-border bg-muted/20 p-3 font-mono text-[11px] leading-relaxed text-foreground outline-none focus:border-orange-500"
              spellCheck={false}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="type-label text-foreground">Required CSV header</span>
                <button
                  type="button"
                  onClick={() => copy(CSV_HEADER, "header")}
                  className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  {copied === "header" ? "Copied" : "Copy header"}
                </button>
              </div>
              <code className="block break-all border border-border bg-muted/20 p-2 font-mono text-[11px] text-foreground">
                {CSV_HEADER}
              </code>
            </div>

            <div className="space-y-2">
              <span className="type-label text-foreground">What happens on import</span>
              <ul className="space-y-1 text-[11px] text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Zap className="mt-0.5 h-3 w-3 shrink-0 text-orange-500" />
                  <span>Rows are matched to the catalog by number, slug, then title.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="mt-0.5 h-3 w-3 shrink-0 text-orange-500" />
                  <span>Blank status becomes <span className="font-mono">Solved (cold)</span> — override in bulk or per row before commit.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="mt-0.5 h-3 w-3 shrink-0 text-orange-500" />
                  <span>Due dates spread over ~60 days so the review queue doesn't flood.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="mt-0.5 h-3 w-3 shrink-0 text-orange-500" />
                  <span>Solved dates (YYYY-MM-DD) are stored on each entry for recency sorting on /problems.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  body,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className={cn("space-y-1.5 border border-border bg-muted/20 p-3")}>
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center border border-border bg-background text-[10px] tabular-nums text-muted-foreground">
          {n}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          {icon}
          {title}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{body}</p>
    </li>
  );
}
