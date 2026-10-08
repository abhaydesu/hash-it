/**
 * Lists accounts that look like test fixtures and (with --confirm) deletes them.
 *
 *   npx tsx scripts/purge-test-users.ts            # dry run: prints every account, deletes nothing
 *   npx tsx scripts/purge-test-users.ts --confirm  # deletes the accounts flagged CANDIDATE
 *
 * Heuristic, deliberately narrow: no linked OAuth account AND (test-style email domain or a
 * generated `usr_` id). Anything with a Google sign-in is never a candidate. Review the dry-run
 * list with the owner before running --confirm; pass --only a@x.com,b@y.com to restrict deletion.
 */
import { PrismaClient } from "@prisma/client";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const TEST_DOMAINS = ["@example.com", "@hashit.local"];

async function main() {
  const confirm = process.argv.includes("--confirm");
  const onlyArg = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
  const only = onlyArg ? new Set(onlyArg.split(",")) : null;
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, _count: { select: { entries: true, accounts: true } } },
      orderBy: { email: "asc" },
    });
    const rows = users.map((u) => {
      const email = u.email ?? "";
      const looksTest =
        u._count.accounts === 0 && (TEST_DOMAINS.some((d) => email.endsWith(d)) || u.id.startsWith("usr_"));
      return { ...u, candidate: looksTest && (!only || only.has(email)) };
    });

    for (const r of rows) {
      console.log(
        `${r.candidate ? "CANDIDATE" : "keep     "}  ${r.email ?? "(no email)"}  entries=${r._count.entries} oauth=${r._count.accounts}`
      );
    }
    const targets = rows.filter((r) => r.candidate);
    console.log(`\n${targets.length} of ${rows.length} accounts would be deleted (cascade removes their entries).`);

    if (!confirm) {
      console.log("Dry run — nothing deleted. Re-run with --confirm after review.");
      return;
    }
    for (const t of targets) {
      await prisma.user.delete({ where: { id: t.id } });
      console.log(`deleted ${t.email}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
