import { NextResponse } from "next/server";
import { syncLeetCode } from "@/scripts/sync-leetcode";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncLeetCode();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/sync-leetcode]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
