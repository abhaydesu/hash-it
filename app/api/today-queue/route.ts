import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDailyReviewQueue, getOverdueCount } from "@/lib/dashboard";
import { getDashboardSnapshot } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();

  const [queueResult, overdueCount, snapshot] = await Promise.all([
    getDailyReviewQueue(userId, now),
    getOverdueCount(userId, now),
    getDashboardSnapshot(userId, now),
  ]);

  return NextResponse.json({
    queue: queueResult.queue,
    resolveCount: queueResult.resolveCount,
    recallCount: queueResult.recallCount,
    overdueCount,
    snapshot: {
      totalEntries: snapshot.stats.totalEntries,
      coldSolveRate: snapshot.stats.coldSolveRate,
      leechCount: snapshot.stats.leechCount,
    },
  });
}
