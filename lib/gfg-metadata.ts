export type AppDifficulty = "EASY" | "MEDIUM" | "HARD";

export type GfgProblemMetadata = {
  title: string;
  slug: string;
  difficulty: AppDifficulty | null;
  topicTags: string[];
  url: string;
};

export function mapGfgDifficulty(raw?: string | null): AppDifficulty | null {
  if (!raw) return null;
  const d = raw.trim().toLowerCase();
  if (d === "hard") return "HARD";
  if (d === "medium") return "MEDIUM";
  if (d === "easy" || d === "basic" || d === "school") return "EASY";
  return null;
}

export async function fetchGfgProblemMetadata(
  slug: string,
  opts?: { signal?: AbortSignal }
): Promise<GfgProblemMetadata | null> {
  const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!cleanSlug || cleanSlug === "1") return null;

  const endpoint = `https://practiceapi.geeksforgeeks.org/api/latest/problems/${encodeURIComponent(cleanSlug)}/`;

  try {
    const res = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "User-Agent": "hash-it/1.0",
      },
      signal: opts?.signal,
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!res.ok) return null;

    const body = (await res.json()) as {
      results?: {
        problem_name?: string;
        slug?: string;
        difficulty?: string;
        problem_level_text?: string;
        tags?: { topic_tags?: string[]; company_tags?: string[] };
      };
    };

    const result = body.results;
    if (!result?.problem_name) return null;

    const topicTags = Array.isArray(result.tags?.topic_tags)
      ? result.tags!.topic_tags!.map((t) => String(t).trim()).filter(Boolean)
      : [];

    const resolvedSlug = (result.slug || cleanSlug).toLowerCase();

    return {
      title: result.problem_name.trim(),
      slug: resolvedSlug,
      difficulty: mapGfgDifficulty(result.difficulty || result.problem_level_text),
      topicTags,
      url: `https://www.geeksforgeeks.org/problems/${resolvedSlug}/1`,
    };
  } catch {
    return null;
  }
}
