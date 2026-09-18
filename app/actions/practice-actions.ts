"use server";

import { getCurrentUser } from "@/lib/auth";
import { getPracticeProblems } from "@/lib/practice";

export async function fetchPracticeSet(patternId: string) {
  const user = await getCurrentUser();
  return getPracticeProblems(patternId, user.id);
}
