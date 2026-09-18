import React, { Suspense } from "react";
import { getPracticePatterns } from "@/lib/practice";
import { PracticeClient } from "@/components/practice-client";
import { SheetSection } from "@/components/ui/sheet-section";

export const dynamic = "force-dynamic";

export default function PracticePage() {
  return (
    <Suspense fallback={<PracticeSkeleton />}>
      <PracticeData />
    </Suspense>
  );
}

async function PracticeData() {
  const patterns = await getPracticePatterns();
  return <PracticeClient patterns={patterns} />;
}

function PracticeSkeleton() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="py-6">
        <div className="h-7 w-28 bg-muted rounded" />
        <div className="mt-2 h-4 w-72 bg-muted rounded" />
      </SheetSection>
      <SheetSection innerClassName="py-6">
        <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted/30" />
          ))}
        </div>
      </SheetSection>
    </div>
  );
}
