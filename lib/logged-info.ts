import { prisma } from "@/lib/prisma";
import type { LoggedInfo } from "@/lib/logged-format";

/** The user's existing entry for each of these problems, keyed by problem id. One query for any number of problems. */
export async function loggedInfoFor(userId: string, problemIds: string[]): Promise<Record<string, LoggedInfo>> {
  if (problemIds.length === 0) return {};
  const entries = await prisma.entry.findMany({
    where: { userId, problemId: { in: problemIds } },
    select: {
      id: true,
      problemId: true,
      status: true,
      firstSolvedAt: true,
      reviewCard: { select: { due: true } },
      attempts: { orderBy: { at: "desc" }, take: 1, select: { at: true } },
    },
  });
  return Object.fromEntries(
    entries.map((e) => [
      e.problemId,
      {
        entryId: e.id,
        status: e.status,
        lastAt: (e.attempts[0]?.at ?? e.firstSolvedAt).toISOString(),
        nextDue: e.reviewCard?.due.toISOString() ?? null,
      } satisfies LoggedInfo,
    ]),
  );
}

/** Add `logged` (or null) to each serialized problem. */
export async function attachLogged<T extends { id: string }>(userId: string, problems: T[]) {
  const info = await loggedInfoFor(userId, problems.map((p) => p.id));
  return problems.map((p) => ({ ...p, logged: info[p.id] ?? null }));
}
