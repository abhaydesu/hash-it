import { PrismaClient } from "@prisma/client";
import { deriveLane, failedRecallPending, hasQueueReview, neverSolvedCold, type LaneAttempt } from "../lib/scheduler";

const prisma = new PrismaClient();

async function main() {
  const confirm = process.argv.includes("--confirm");
  const now = new Date();
  const candidates = await prisma.entry.findMany({
    where: { revisit: true, importBatchId: { not: null } },
    select: { id: true },
  });
  const beforeCount = await prisma.entry.count({ where: { revisit: true, importBatchId: { not: null } } });
  const cards = await prisma.reviewCard.findMany({
    where: { due: { lte: now } },
    select: {
      lapses: true,
      entry: {
        select: {
          revisit: true,
          importBatchId: true,
          attempts: { orderBy: { at: "desc" }, select: { rating: true, lane: true, at: true } },
        },
      },
    },
  });

  const split = (afterCleanup: boolean) => {
    const result = { RESOLVE: 0, RECALL: 0 };
    for (const card of cards) {
      const attempts = card.entry.attempts as LaneAttempt[];
      const lane = deriveLane({
        reviewed: hasQueueReview(attempts),
        neverSolvedCold: neverSolvedCold(attempts),
        revisit: card.entry.revisit && !(afterCleanup && card.entry.importBatchId),
        lapses: card.lapses,
        failedRecall: failedRecallPending(attempts),
      });
      result[lane]++;
    }
    return result;
  };

  console.log(`Mode: ${confirm ? "CONFIRM" : "DRY RUN"}`);
  console.log(`Imported revisit entries before: ${beforeCount}`);
  console.log(`Imported revisit entries after: ${confirm ? Math.max(0, beforeCount - candidates.length) : beforeCount}`);
  console.log(`Due lane split before: ${JSON.stringify(split(false))}`);
  console.log(`Due lane split after: ${JSON.stringify(split(true))}`);

  if (confirm && candidates.length > 0) {
    const updated = await prisma.entry.updateMany({
      where: { id: { in: candidates.map((entry) => entry.id) }, revisit: true },
      data: { revisit: false },
    });
    const afterCount = await prisma.entry.count({ where: { revisit: true, importBatchId: { not: null } } });
    console.log(`Entries cleared: ${updated.count}`);
    console.log(`Verified imported revisit entries after: ${afterCount}`);
    // ReviewCard rows and due dates are deliberately untouched.
  } else if (!confirm) {
    console.log("No changes made. Pass --confirm to clear these imported flags.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
