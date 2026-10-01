import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildMonthlyMockSet } from "@/lib/monthly-mock-set";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const now = new Date();
    const problems = await buildMonthlyMockSet(userId, now);

    return NextResponse.json({
      mockId: `mock_${Date.now()}`,
      problemCount: problems.length,
      problems,
    });
  } catch (err) {
    console.error("[api/review/monthly]", err);
    return NextResponse.json({ error: "Failed to load monthly mock" }, { status: 500 });
  }
}
