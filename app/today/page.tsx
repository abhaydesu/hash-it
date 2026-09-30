import React, { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { canSeeRoadmap } from "@/lib/roadmap-access";
import { getGreeting } from "@/lib/greeting";
import { prisma } from "@/lib/prisma";
import { getDailyReviewQueue, getHeadlineStats } from "@/lib/dashboard";
import { getUserTimezone } from "@/lib/user-settings";
import { TodayClient } from "@/components/today-client";
import { getActivePlan } from "@/lib/weekly-review";
import { getMonthlyMockState } from "@/lib/monthly-mock";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";
import { SheetSection } from "@/components/ui/sheet-section";

export const dynamic = "force-dynamic";

const NEW_USER_ENTRY_LIMIT = 5;

export default function TodayPage() {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <TodayData />
    </Suspense>
  );
}

async function TodayData() {
  const user = await getCurrentUser();
  const now = new Date();

  const [queueResult, snapshot, weeklyPlan, monthly, account, timezone] = await Promise.all([
    getDailyReviewQueue(user.id, now),
    getHeadlineStats(user.id),
    getActivePlan(user.id, now),
    getMonthlyMockState(user.id, now),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { importPromptDismissedAt: true, _count: { select: { importBatches: true } } },
    }),
    getUserTimezone(user.id),
  ]);
  const { overdueCount } = queueResult;
  // Only nudge people who look new: haven't answered the banner, haven't imported, and have a near-empty log.
  const showImportPrompt =
    !account?.importPromptDismissedAt &&
    (account?._count.importBatches ?? 0) === 0 &&
    snapshot.totalEntries < NEW_USER_ENTRY_LIMIT;
  const lastMock = monthly.history[0];

  return (
    <TodayClient
      data={{
        queue: queueResult.queue,
        resolveCount: queueResult.resolveCount,
        recallCount: queueResult.recallCount,
        doneToday: queueResult.doneToday,
        overdueCount,
        showRoadmap: canSeeRoadmap(user.email),
        showImportPrompt,
        greeting: getGreeting({ now, timezone, name: user.name }),
        snapshot,
        weeklyPlan,
        monthlyStatus: monthly.status,
        lastMock: lastMock ? { solved: lastMock.solved, total: lastMock.solved + lastMock.hinted + lastMock.failed } : null,
      }}
    />
  );
}

function TodaySkeleton() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="flex flex-col gap-3 py-6 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <div className="h-7 w-32 bg-muted rounded"></div>
          <div className="mt-2 h-4 w-64 bg-muted rounded"></div>
        </div>
        <div className="h-8 w-32 bg-muted rounded"></div>
      </SheetSection>

      <SheetSection innerClassName="py-6" band="neutral">
        <SpecGrid columns={4}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SpecCell
              key={i}
              label={<div className="h-3 w-20 bg-muted/60 rounded" />}
              value={<div className="h-6 w-12 bg-muted rounded mt-1" />}
            />
          ))}
        </SpecGrid>
      </SheetSection>

      <SheetSection innerClassName="py-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-5 w-24 bg-muted rounded"></div>
          <div className="h-4 w-48 bg-muted rounded"></div>
        </div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 w-full bg-muted/40 border border-border"></div>
          ))}
        </div>
      </SheetSection>
    </div>
  );
}
