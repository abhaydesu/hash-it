import { prisma } from "@/lib/prisma";
import { monthlyStatus, type MonthlyStatus } from "@/lib/review-windows";
import { getUserTimezone } from "@/lib/user-settings";

export interface MockResult {
  period: string;
  solved: number;
  hinted: number;
  failed: number;
  durationSec: number;
}

export interface MonthlyMockState {
  status: MonthlyStatus;
  /** Most recent first. */
  history: MockResult[];
}


export async function getMonthlyMockState(userId: string, now: Date = new Date()): Promise<MonthlyMockState> {
  const [timezone, mocks] = await Promise.all([
    getUserTimezone(userId),
    prisma.monthlyMock.findMany({
      where: { userId },
      orderBy: { period: "desc" },
      select: { period: true, solved: true, hinted: true, failed: true, durationSec: true },
    }),
  ]);
  return {
    status: monthlyStatus(now, timezone, mocks.map((m) => m.period)),
    history: mocks.slice(0, 6),
  };
}

/**
 * Record a finished mock against the earliest month still owed. Idempotent per
 * client session: a finished session restored from storage returns the same record.
 */
export async function recordMonthlyMock(
  userId: string,
  result: Omit<MockResult, "period"> & { sessionId: string },
  now: Date = new Date(),
) {
  const existing = await prisma.monthlyMock.findUnique({ where: { sessionId: result.sessionId } });
  if (existing) {
    if (existing.userId !== userId) throw new Error("Session not found.");
    return existing;
  }
  const { status } = await getMonthlyMockState(userId, now);
  return prisma.monthlyMock.create({
    data: { userId, period: status.creditPeriod, ...result },
  });
}
