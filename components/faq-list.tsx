import React from "react";
import { ChevronDown } from "lucide-react";

/**
 * Expandable FAQ. Native <details>/<summary>: keyboard and screen-reader support for free,
 * works without JavaScript, and answers stay in the HTML so search engines still read them.
 */
export function FaqList({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <div className="divide-y divide-border border border-border bg-background">
      {items.map(({ q, a }) => (
        <details key={q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-muted/30 sm:px-5 [&::-webkit-details-marker]:hidden">
            <h3 className="text-sm font-medium text-foreground">{q}</h3>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground sm:px-5 sm:pb-5">{a}</p>
        </details>
      ))}
    </div>
  );
}
