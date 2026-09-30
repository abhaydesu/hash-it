import React from "react";
import { SheetSection } from "@/components/ui/sheet-section";

export default function ImportLoading() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="py-6">
        <div className="h-7 w-28 bg-muted rounded"></div>
        <div className="mt-2 h-4 w-96 max-w-full bg-muted rounded"></div>
      </SheetSection>
      <SheetSection innerClassName="py-4">
        <div className="h-8 w-full bg-muted/40 border border-border"></div>
      </SheetSection>
      <SheetSection innerClassName="py-6" last>
        <div className="h-48 w-full bg-muted/30 border border-border"></div>
      </SheetSection>
    </div>
  );
}
