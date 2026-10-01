import React, { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { MonthlyReviewClient } from "@/components/monthly-review-client";
import { getMonthlyMockState } from "@/lib/monthly-mock";
import { buildMonthlyMockSet } from "@/lib/monthly-mock-set";
import { SheetSection } from "@/components/ui/sheet-section";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Monthly mock" };

export default function MonthlyMockPage() {
  return (
    <Suspense fallback={<MonthlySkeleton />}>
      <MonthlyMockData />
    </Suspense>
  );
}

async function MonthlyMockData() {
  const user = await getCurrentUser();
  const now = new Date();
  const [mockState, catalog] = await Promise.all([getMonthlyMockState(user.id, now), buildMonthlyMockSet(user.id, now)]);

  return <MonthlyReviewClient initialCatalog={catalog} mockState={mockState} />;
}

function MonthlySkeleton() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="mx-auto space-y-5 py-8">
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-muted rounded"></div>
            <div className="h-4 w-36 bg-muted rounded"></div>
          </div>

          <div className="h-8 w-96 bg-muted rounded"></div>

          <div className="space-y-2">
            <div className="h-4 w-full bg-muted rounded"></div>
            <div className="h-4 w-5/6 bg-muted rounded"></div>
          </div>

          <div className="h-4 w-4/5 bg-muted/70 rounded"></div>

          <div className="space-y-2.5 border border-border bg-muted/40 p-4">
            <div className="h-4 w-32 bg-muted rounded"></div>
            <div className="space-y-2 pt-1">
              <div className="h-3 w-3/4 bg-muted/60 rounded"></div>
              <div className="h-3 w-5/6 bg-muted/60 rounded"></div>
              <div className="h-3 w-2/3 bg-muted/60 rounded"></div>
              <div className="h-3 w-4/5 bg-muted/60 rounded"></div>
            </div>
          </div>

          <div className="pt-2">
            <div className="h-9 w-36 bg-muted rounded"></div>
          </div>
        </div>
      </SheetSection>
    </div>
  );
}
