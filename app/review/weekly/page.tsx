import { getCurrentUser } from "@/lib/auth";
import { getWeeklyReview } from "@/lib/weekly-review";
import { getUpcomingContests } from "@/lib/contests";
import { WeeklyReviewClient } from "@/components/weekly-review-client";

export const dynamic = "force-dynamic";

// Loading UI lives in ./loading.tsx.
export default async function WeeklyReviewPage() {
  const user = await getCurrentUser();
  const [data, contests] = await Promise.all([getWeeklyReview(user.id), getUpcomingContests()]);
  return <WeeklyReviewClient data={data} contests={contests} />;
}
