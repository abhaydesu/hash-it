/**
 * One-time backfill: entries logged while `createEntry` only scheduled a review
 * for AGAIN/HARD/revisit rows never got a ReviewCard, so cleanly solved problems
 * silently left the rotation. Every entry is scheduled now, and these need to be
 * caught up.
 *
 * Each card is seeded from the rating its own log implies, then due dates are
 * spread across the next few weeks — oldest solve first, since that memory has
 * decayed most — so the queue is not flooded on day one.
 *
 * Usage: npx tsx scripts/backfill-missing-review-cards.ts [--dry-run] [--days=21]
 */

import { prisma } from "../lib/prisma";
import {
  deriveRating,
  seedCard,
  type ProblemDifficulty,
  type SolveStatusType,
} from "../lib/scheduler";
import type { CardState } from "@prisma/client";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const daysArg = process.argv.find((a) => a.startsWith("--days="));
  const spreadDays = daysArg ? Number(daysArg.split("=")[1]) : 21;
  if (dryRun) console.log("=== DRY RUN — no changes will be written ===\n");

  const orphans = await prisma.entry.findMany({
    where: { reviewCard: { is: null } },
    select: {
      id: true,
      userId: true,
      status: true,
      minutes: true,
      firstSolvedAt: true,
      problem: { select: { title: true, difficulty: true } },
    },
    orderBy: { firstSolvedAt: "asc" },
  });

  console.log(`Found ${orphans.length} entries with no review card.\n`);
  if (orphans.length === 0) return;

  const settingsByUser = new Map<string, Awaited<ReturnType<typeof prisma.userSettings.findUnique>>>();
  for (const userId of new Set(orphans.map((o) => o.userId))) {
    settingsByUser.set(userId, await prisma.userSettings.findUnique({ where: { userId } }));
  }

  const now = new Date();
  const pending: any[] = [];
  const byUser = new Map<string, typeof orphans>();
  for (const o of orphans) {
    const list = byUser.get(o.userId) ?? [];
    list.push(o);
    byUser.set(o.userId, list);
  }

  let created = 0;
  for (const [userId, entries] of byUser) {
    const settings = settingsByUser.get(userId);
    const baselines = settings
      ? { easy: settings.easyBaseline, medium: settings.mediumBaseline, hard: settings.hardBaseline }
      : undefined;

    console.log(`user ${userId} — ${entries.length} entries`);

    entries.forEach((entry, index) => {
      const rating = deriveRating({
        status: entry.status as SolveStatusType,
        minutes: entry.minutes,
        usedHint: entry.status === "SOLVED_WITH_HELP",
        difficulty: entry.problem.difficulty as ProblemDifficulty | null,
        baselines,
      });

      const card = seedCard({
        entryId: entry.id,
        rating,
        now,
        desiredRetention: settings?.desiredRetention ?? 0.8,
        fsrsParams: (settings?.fsrsParams as number[]) ?? [],
      });

      // Spread evenly instead of letting every card land on its seeded due date.
      const offset = Math.floor((index * spreadDays) / Math.max(1, entries.length));
      const due = new Date(now);
      due.setDate(due.getDate() + offset);

      console.log(
        `  +${String(offset).padStart(2)}d  ${rating.padEnd(5)}  ${entry.problem.title.slice(0, 48)}`
      );

      if (!dryRun) {
        pending.push(
          prisma.reviewCard.create({
            data: {
              entryId: entry.id,
              due,
              stability: card.stability,
              difficulty: card.difficulty,
              elapsedDays: card.elapsedDays,
              scheduledDays: card.scheduledDays,
              reps: card.reps,
              lapses: card.lapses,
              state: card.state as CardState,
              lastReview: entry.firstSolvedAt ?? now,
            },
          })
        );
      }
      created++;
    });
    console.log("");
  }

  if (!dryRun) {
    await prisma.$transaction(pending);
  }

  console.log(`${dryRun ? "Would create" : "Created"} ${created} review cards.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
