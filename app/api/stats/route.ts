import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { computeAllStats } from "@/lib/stats-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { headline, ...rest } = await computeAllStats(session.user.id);
    // Headline metrics stay at the root for existing consumers.
    return NextResponse.json({ ...headline, ...rest });
  } catch (err) {
    console.error("[api/stats]", err);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
