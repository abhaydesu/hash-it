import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getWeeklyReview } from "@/lib/weekly-review";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await getWeeklyReview(session.user.id));
  } catch (err) {
    console.error("[api/review/weekly]", err);
    return NextResponse.json({ error: "Failed to load weekly review" }, { status: 500 });
  }
}
