/**
 * One-time migration: `revisit` used to depress the seeded FSRS grade (first to
 * Again, then to Hard), leaving imported cards at stability ~0.40/~1.18. A cold
 * solve on such a card only bought 4 days. `revisit` is a "practice this
 * someday" marker, not evidence of weak recall, so these re-seed at Good.
 *
 * Only touches cards that have never been reviewed in-app, so their stability is
 * purely the seed and not earned review history. Due dates are left alone to
 * avoid emptying the current queue.
 *
 * Usage: npx tsx scripts/fix-revisit-stability.ts [--dry-run]
 */

import { prisma } from "../lib/prisma";
import {
  fsrs,
  createEmptyCard,
  Rating as FSRSRating,
  generatorParameters,
} from "ts-fsrs";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("=== DRY RUN — no changes will be written ===\n");

  const affected = await prisma.reviewCard.findMany({
    where: {
      entry: {
        revisit: true,
        status: { not: "ATTEMPTED_FAILED" },
        attempts: { none: {} },
      },
    },
    include: {
      entry: {
        select: {
          id: true,
          userId: true,
          status: true,
          problem: { select: { title: true } },
        },
      },
    },
  });

  console.log(`Found ${affected.length} never-reviewed revisit cards.\n`);
  if (affected.length === 0) return;

  const userIds = [...new Set(affected.map((c) => c.entry.userId))];
  const settingsMap = new Map<string, { desiredRetention: number; fsrsParams: number[] }>();
  for (const userId of userIds) {
    const s = await prisma.userSettings.findUnique({ where: { userId } });
    settingsMap.set(userId, {
      desiredRetention: s?.desiredRetention ?? 0.8,
      fsrsParams: (s?.fsrsParams as number[]) ?? [],
    });
  }

  let fixed = 0;
  for (const card of affected) {
    const settings = settingsMap.get(card.entry.userId)!;
    const f = fsrs(
      generatorParameters({
        request_retention: settings.desiredRetention,
        ...(settings.fsrsParams.length > 0 ? { w: settings.fsrsParams as any } : {}),
      })
    );

    // SOLVED_WITH_HELP legitimately seeds at Hard; everything else gets Good.
    const grade =
      card.entry.status === "SOLVED_WITH_HELP" ? FSRSRating.Hard : FSRSRating.Good;

    const now = card.lastReview ?? new Date();
    const reseeded = f.repeat(createEmptyCard(now), now)[grade].card;

    if (reseeded.stability <= card.stability) continue;

    console.log(
      `  ${card.entry.problem.title}: ${card.stability.toFixed(2)} → ${reseeded.stability.toFixed(2)}`
    );

    if (!dryRun) {
      await prisma.reviewCard.update({
        where: { entryId: card.entryId },
        data: { stability: reseeded.stability, difficulty: reseeded.difficulty },
      });
    }
    fixed++;
  }

  console.log(`\n${dryRun ? "Would fix" : "Fixed"} ${fixed} cards.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
