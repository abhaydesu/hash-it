"use client";

import React, { useState, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

function FaqItem({
  q,
  a,
  defaultOpen = false,
}: {
  q: string;
  a: string;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const id = useId();
  const panelId = `faq-panel-${id}`;
  const buttonId = `faq-btn-${id}`;

  return (
    <div className="group">
      <h3>
        <button
          type="button"
          id={buttonId}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex w-full cursor-pointer items-center justify-between gap-4 p-4 text-left transition-colors duration-150 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:px-5 sm:py-4.5"
        >
          <span className="text-sm font-medium text-foreground">{q}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-[260ms] ease-out motion-reduce:transition-none",
              isOpen && "rotate-180 text-foreground"
            )}
            aria-hidden
          />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-[260ms] ease-out motion-reduce:transition-none",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground sm:px-5 sm:pb-5">{a}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Expandable FAQ with smooth grid-template-rows height & opacity transitions.
 * Accessible with WAI-ARIA accordion semantics (aria-expanded, aria-controls, role="region").
 * Answers remain in the HTML DOM at all times so search engines and screen readers can index them.
 */
export function FaqList({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <div className="divide-y divide-border border border-border bg-background">
      {items.map(({ q, a }) => (
        <FaqItem key={q} q={q} a={a} />
      ))}
    </div>
  );
}
