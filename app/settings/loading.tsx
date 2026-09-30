import React from "react";
import { SheetSection } from "@/components/ui/sheet-section";

export default function SettingsLoading() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="py-6">
        <div className="h-7 w-32 bg-muted rounded"></div>
        <div className="mt-2 h-4 w-96 max-w-full bg-muted rounded"></div>
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
