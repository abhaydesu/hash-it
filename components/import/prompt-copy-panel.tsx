"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildLeetcodePrompt, CSV_HEADER } from "@/lib/leetcode-import-prompt";

export function PromptCopyPanel() {
  const [copied, setCopied] = useState<"prompt" | "header" | null>(null);
  const prompt = buildLeetcodePrompt();

  const copy = async (text: string, key: "prompt" | "header") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((prev) => (prev === key ? null : prev)), 1600);
    } catch {
      /* clipboard blocked — textarea select-all still works */
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="type-label text-foreground">The prompt (patterns baked in)</span>
        <Button variant="primary" size="sm" className="min-w-[5.5rem] justify-center" onClick={() => copy(prompt, "prompt")}>
          {copied === "prompt" ? (
            <>
              <Check className="icon-pop mr-1.5 h-3 w-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-1.5 h-3 w-3" />
              Copy
            </>
          )}
        </Button>
      </div>

      <textarea
        readOnly
        value={prompt}
        rows={14}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full resize-y border border-border bg-muted/20 p-3 font-mono text-[11px] leading-relaxed text-foreground outline-none focus:border-orange-500"
        spellCheck={false}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <span className="type-caption">
          Expected CSV header —{" "}
          <code className="break-all font-mono text-[11px] text-foreground">{CSV_HEADER}</code>
        </span>
        <button
          type="button"
          onClick={() => copy(CSV_HEADER, "header")}
          className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {copied === "header" ? "Copied" : "Copy header only"}
        </button>
      </div>
    </div>
  );
}
