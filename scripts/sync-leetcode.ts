import { prisma } from "@/lib/prisma";
import { Platform, Difficulty } from "@prisma/client";

const GRAPHQL_URL = "https://leetcode.com/graphql";
const QUERY = `
query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
    total: totalNum
    questions: data {
      frontendQuestionId: questionFrontendId
      title
      titleSlug
      difficulty
      acRate
      paidOnly: isPaidOnly
      topicTags { name slug }
    }
  }
}`;

const DIFFICULTY_MAP: Record<string, Difficulty> = {
  Easy: Difficulty.EASY,
  Medium: Difficulty.MEDIUM,
  Hard: Difficulty.HARD,
};

interface LCTag { name: string; slug: string }
interface LCQuestion {
  frontendQuestionId: string;
  title: string;
  titleSlug: string;
  difficulty: string;
  acRate: number;
  paidOnly: boolean;
  topicTags: LCTag[];
}

async function fetchPage(skip: number, limit: number = 100, retries = 3): Promise<{ total: number; questions: LCQuestion[] }> {
  const body = JSON.stringify({
    operationName: "problemsetQuestionList",
    variables: { categorySlug: "", skip, limit, filters: {} },
    query: QUERY,
  });

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "referer": "https://leetcode.com/problemset/all/",
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        body,
        signal: AbortSignal.timeout(15000),
      });

      if (res.status === 429 || res.status === 403) {
        const waitMs = Math.pow(2, attempt) * 2000;
        console.warn(`[LeetCode sync] Rate limited (${res.status}), waiting ${waitMs}ms...`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json() as {
        data?: {
          problemsetQuestionList?: { total: number; questions: LCQuestion[] };
        };
        errors?: { message: string }[];
      };

      if (json.errors?.length) {
        throw new Error(`GraphQL errors: ${json.errors.map(e => e.message).join(", ")}`);
      }

      const list = json.data?.problemsetQuestionList;
      if (!list || typeof list.total !== "number") {
        throw new Error("Unexpected response shape from LeetCode GraphQL: " + JSON.stringify(json).slice(0, 300));
      }

      return list;
    } catch (err) {
      if (attempt === retries) throw err;
      const waitMs = Math.pow(2, attempt) * 1000;
      console.warn(`[LeetCode sync] Error (attempt ${attempt}), retrying in ${waitMs}ms:`, err);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  throw new Error(`Failed after ${retries} retries`);
}

export interface SyncResult {
  added: number;
  updated: number;
  total: number;
  errors?: string;
}

export async function syncLeetCode(): Promise<SyncResult> {
  const PAGE_SIZE = 100;
  const now = new Date();

  let skip = 0;
  let total = Infinity;
  let added = 0;
  let updated = 0;
  let consecutiveFailures = 0;

  console.log("[LeetCode sync] Starting full problemset sync...");

  while (skip < total) {
    if (consecutiveFailures >= 3) {
      console.error("[LeetCode sync] 3 consecutive failures. Aborting run. Existing rows untouched.");
      return { added, updated, total, errors: "Aborted: 3 consecutive failures" };
    }

    try {
      const page = await fetchPage(skip, PAGE_SIZE);
      if (skip === 0) {
        total = page.total;
        console.log(`[LeetCode sync] Total problems: ${total}`);
      }

      for (const q of page.questions) {
        const num = parseInt(q.frontendQuestionId, 10);
        const tags = q.topicTags.map((t) => t.name);

        const existing = await prisma.problem.findFirst({
          where: { platform: Platform.LEETCODE, slug: q.titleSlug },
          select: { id: true },
        });

        const data = {
          number: isNaN(num) ? null : num,
          title: q.title,
          url: `https://leetcode.com/problems/${q.titleSlug}/`,
          difficulty: DIFFICULTY_MAP[q.difficulty] ?? null,
          acRate: q.acRate ?? null,
          isPaidOnly: q.paidOnly ?? false,
          topicTags: tags,
          lastSyncedAt: now,
        };

        if (existing) {
          await prisma.problem.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await prisma.problem.create({
            data: { platform: Platform.LEETCODE, slug: q.titleSlug, ...data },
          });
          added++;
        }
      }

      consecutiveFailures = 0;
      skip += PAGE_SIZE;

      console.log(`[LeetCode sync] Progress: ${Math.min(skip, total)}/${total} (+${added} new, ~${updated} updated)`);

      // 1 request/second rate limit
      if (skip < total) await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      consecutiveFailures++;
      console.error(`[LeetCode sync] Page error (skip=${skip}):`, err);
    }
  }

  console.log(`[LeetCode sync] Done. Added: ${added}, Updated: ${updated}`);
  return { added, updated, total };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncLeetCode()
    .then((r) => {
      console.log("Sync result:", r);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Fatal sync error:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
