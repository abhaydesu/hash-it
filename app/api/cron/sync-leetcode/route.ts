import { NextResponse } from "next/server";
import { syncLeetCode } from "@/scripts/sync-leetcode";
import { secretsEqual } from "@/lib/safe";

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret");
  if (!secretsEqual(secret, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncLeetCode();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/sync-leetcode]", err);
    return NextResponse.json({ ok: false, error: "Sync failed" }, { status: 500 });
  }
}
