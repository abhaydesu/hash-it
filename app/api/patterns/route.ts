import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { patternMatchKey } from "@/lib/pattern-match";

export const dynamic = "force-dynamic";

/** Pattern names the user can pick from: their own most-used first, then the built-in catalog. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [entries, catalog] = await Promise.all([
      prisma.entry.findMany({
        where: { userId: session.user.id, patternOverride: { isEmpty: false } },
        select: { patternOverride: true },
      }),
      prisma.pattern.findMany({ select: { name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    ]);

    const byKey = new Map<string, { name: string; count: number }>();
    for (const e of entries) {
      for (const raw of e.patternOverride) {
        const name = raw.trim();
        const key = patternMatchKey(name);
        if (!key) continue;
        const hit = byKey.get(key);
        if (hit) hit.count++;
        else byKey.set(key, { name, count: 1 });
      }
    }
    const used = [...byKey.values()].sort((a, b) => b.count - a.count).map((x) => x.name);
    const seen = new Set(byKey.keys());
    const rest = catalog.map((c) => c.name).filter((n) => !seen.has(patternMatchKey(n)));

    return NextResponse.json({ patterns: [...used, ...rest] });
  } catch (err) {
    console.error("[api/patterns]", err);
    return NextResponse.json({ error: "Failed to load patterns" }, { status: 500 });
  }
}
