import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const isConfirm = process.argv.includes("--confirm");

  console.log("== Prune Clean Solve Review Cards ==");
  console.log(`Mode: ${isConfirm ? "CONFIRM (will delete)" : "DRY RUN (pass --confirm to delete)"}\n`);

  // Query ReviewCards where associated entry is a clean solve:
  // 1. Entry has 1 attempt rated GOOD/EASY, reps <= 1, lapses === 0, revisit === false
  // OR
  // 2. Entry has 0 attempts, status is SOLVED_UNAIDED, reps <= 1, lapses === 0, revisit === false
  const candidateCards = await prisma.reviewCard.findMany({
    where: {
      reps: { lte: 1 },
      lapses: 0,
      entry: {
        revisit: false,
      },
    },
    include: {
      entry: {
        include: {
          problem: true,
          attempts: true,
        },
      },
    },
  });

  const toPrune = candidateCards.filter((card) => {
    const attempts = card.entry.attempts;
    if (attempts.length === 1) {
      return attempts[0].rating === "GOOD" || attempts[0].rating === "EASY";
    }
    if (attempts.length === 0) {
      return card.entry.status === "SOLVED_UNAIDED";
    }
    return false;
  });

  console.log(`Found ${toPrune.length} clean-solve review cards eligible for pruning.`);

  if (toPrune.length > 0) {
    console.log("\nSample candidate cards to prune:");
    toPrune.slice(0, 10).forEach((card, idx) => {
      const p = card.entry.problem;
      const att = card.entry.attempts[0];
      const ratingLabel = att ? `Attempt Rating: ${att.rating}` : `Status: ${card.entry.status} (0 attempts)`;
      console.log(
        `  ${idx + 1}. [${p.platform}] ${p.title} (${ratingLabel}, Reps: ${card.reps}, Lapses: ${card.lapses}, Due: ${card.due.toISOString().split("T")[0]})`
      );
    });
    if (toPrune.length > 10) {
      console.log(`  ... and ${toPrune.length - 10} more.`);
    }
  }

  if (isConfirm && toPrune.length > 0) {
    const entryIds = toPrune.map((c) => c.entryId);
    const deleteResult = await prisma.reviewCard.deleteMany({
      where: {
        entryId: { in: entryIds },
      },
    });
    console.log(`\nDeleted ${deleteResult.count} review cards.`);
  } else if (!isConfirm && toPrune.length > 0) {
    console.log("\nNo changes made. Run with `npx tsx scripts/prune-clean-cards.ts --confirm` to prune.");
  }
}

main()
  .catch((e) => {
    console.error("Prune error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
