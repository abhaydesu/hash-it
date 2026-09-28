// Temporary read-only diagnostic: which schema is this connection on, and which users exist?
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log(await prisma.$queryRawUnsafe(`select current_schema(), current_setting('search_path') as search_path`));
  console.log(
    await prisma.$queryRawUnsafe(
      `select u.id, u.email, (select count(*) from public."Entry" e where e."userId" = u.id)::int as entries
       from public."User" u order by u.email`
    )
  );
}

main().finally(() => prisma.$disconnect());
