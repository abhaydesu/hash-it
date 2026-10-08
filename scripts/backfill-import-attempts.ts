/**
 * Gives imported entries that have no attempt history one IMPORT attempt.
 *
 *   npx tsx scripts/backfill-import-attempts.ts            # dry run: counts only
 *   npx tsx scripts/backfill-import-attempts.ts --confirm  # writes
 *
 * Scope: entries with importBatchId set and zero attempts. Each gets one attempt rated from its
 * status (same derivation as the card seeding), minutes null, at = firstSolvedAt, lane null,
 * source IMPORT. Re-running is a no-op: those entries then have an attempt.
 */
import { PrismaClient } from "@prisma/client";
import nextEnv from "@next/env";
import { importedRating } from "../lib/scheduler";

nextEnv.loadEnvConfig(process.cwd());

async function main() {
  const confirm = process.argv.includes("--confirm");
  const prisma = new PrismaClient();
  try {
    const where = { importBatchId: { not: null }, attempts: { none: {} } } as const;
    const bySource = () => prisma.attempt.groupBy({ by: ["source"], _count: true });

    const targets = await prisma.entry.findMany({
      where,
      select: { id: true, status: true, firstSolvedAt: true },
    });
    console.log(`Mode: ${confirm ? "CONFIRM" : "DRY RUN"}`);
    console.log("Attempts by source before:", JSON.stringify(await bySource()));
    console.log(`Entries with no attempt (all): ${await prisma.entry.count({ where: { attempts: { none: {} } } })}`);
    console.log(`Imported entries with no attempt (would get one): ${targets.length}`);

    if (!confirm) {
      console.log("Dry run — nothing written. Re-run with --confirm.");
      return;
    }
    const result = await prisma.attempt.createMany({
      data: targets.map((e) => ({
        entryId: e.id,
        at: e.firstSolvedAt,
        rating: importedRating(e.status),
        minutes: null,
        usedHint: e.status === "SOLVED_WITH_HELP",
        lane: null,
        source: "IMPORT" as const,
      })),
    });
    console.log(`Attempts written: ${result.count}`);
    console.log("Attempts by source after:", JSON.stringify(await bySource()));
    console.log(`Imported entries with no attempt after: ${await prisma.entry.count({ where })}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
