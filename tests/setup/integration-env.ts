/**
 * Runs before any module that creates the Prisma client (setup files' imports are
 * hoisted, so this can't live in integration.ts): the client reads DATABASE_URL once.
 */
import { loadEnvConfig } from "@next/env";

// Load .env the way Next does; nothing else has yet at this point.
loadEnvConfig(process.cwd());

// Ensure integration tests use the test schema, over a direct (unpooled) connection.
// Prisma selects the schema with `SET search_path`; through a transaction-mode pooler
// (Neon's "-pooler" host) that setting sticks to shared server connections and leaks
// into every other client — the dev app would silently start reading the test schema.
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("schema", "test_hash_it");
  url.hostname = url.hostname.replace("-pooler.", ".");
  url.searchParams.delete("pgbouncer");
  process.env.DATABASE_URL = url.toString();
}
