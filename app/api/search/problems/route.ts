import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Platform } from "@prisma/client";
import { LIMITS } from "@/lib/safe";
import { parseSlugFromUrl, problemUrlLookupKeys } from "@/lib/problem-url";
import { fetchGfgProblemMetadata } from "@/lib/gfg-metadata";

const problemSelect = {
  id: true,
  platform: true,
  number: true,
  title: true,
  slug: true,
  url: true,
  difficulty: true,
  acRate: true,
  topicTags: true,
  patterns: {
    include: { pattern: { select: { id: true, name: true, family: true } } },
  },
} as const;

function serializeProblem(p: {
  id: string;
  platform: Platform;
  number: number | null;
  title: string;
  slug: string;
  url: string;
  difficulty: string | null;
  acRate: number | null;
  topicTags: string[];
  patterns: Array<{ pattern: { id: string; name: string; family: string } }>;
}) {
  return {
    id: p.id,
    platform: p.platform,
    number: p.number,
    title: p.title,
    slug: p.slug,
    url: p.url,
    difficulty: p.difficulty,
    acRate: p.acRate,
    topicTags: p.topicTags,
    patterns: p.patterns.map((pp) => ({
      id: pp.pattern.id,
      name: pp.pattern.name,
      family: pp.pattern.family,
    })),
  };
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const rawInput = typeof body?.query === "string" ? body.query.trim() : "";
    const raw = rawInput.slice(0, LIMITS.searchQuery);

    if (!raw) {
      return NextResponse.json({ results: [] });
    }

    let urlSlug: string | null = null;
    let urlPlatform: Platform | null = null;

    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      try {
        const parsedUrl = new URL(raw);
        urlSlug = parseSlugFromUrl(raw);
        if (parsedUrl.hostname.includes("leetcode.com")) {
          urlPlatform = Platform.LEETCODE;
        } else if (parsedUrl.hostname.includes("geeksforgeeks.org")) {
          urlPlatform = Platform.GFG;
        } else {
          urlPlatform = Platform.OTHER;
        }
      } catch {
        // Not a valid URL, treat as plain text
      }
    }

    if (urlSlug || urlPlatform) {
      const urlKeys = problemUrlLookupKeys(raw);
      const match = await prisma.problem.findFirst({
        where: {
          OR: [
            ...(urlSlug
              ? [
                  { slug: urlSlug, ...(urlPlatform ? { platform: urlPlatform } : {}) },
                  { slug: urlSlug },
                ]
              : []),
            ...urlKeys.map((u) => ({ url: { equals: u, mode: "insensitive" as const } })),
          ],
        },
        select: problemSelect,
      });

      if (match) {
        // Backfill missing GFG difficulty/topics from practice API when catalog row is sparse
        const needsGfgEnrichment =
          match.platform === Platform.GFG &&
          (!match.difficulty || match.topicTags.length === 0) &&
          urlSlug;

        if (needsGfgEnrichment) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4_000);
          try {
            const meta = await fetchGfgProblemMetadata(urlSlug!, { signal: controller.signal });
            if (meta) {
              const nextDifficulty = match.difficulty || meta.difficulty;
            const nextTags = match.topicTags.length > 0 ? match.topicTags : meta.topicTags;
            if (
              (nextDifficulty && nextDifficulty !== match.difficulty) ||
              (nextTags.length > 0 && match.topicTags.length === 0)
            ) {
              await prisma.problem.update({
                where: { id: match.id },
                data: {
                  ...(nextDifficulty && !match.difficulty ? { difficulty: nextDifficulty } : {}),
                  ...(match.topicTags.length === 0 && nextTags.length > 0
                    ? { topicTags: nextTags }
                    : {}),
                  ...(meta.title && match.title !== meta.title ? { title: meta.title } : {}),
                },
              });
            }

            return NextResponse.json({
              results: [
                serializeProblem({
                  ...match,
                  title: meta.title || match.title,
                  difficulty: nextDifficulty,
                  topicTags: nextTags,
                }),
              ],
            });
          }
        } finally {
          clearTimeout(timeout);
        }
      }

      return NextResponse.json({ results: [serializeProblem(match)] });
      }

      if (urlPlatform === Platform.GFG && urlSlug) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4_000);
        try {
          const meta = await fetchGfgProblemMetadata(urlSlug, { signal: controller.signal });
          if (meta) {
            const roadmapHit = await prisma.roadmapItem.findFirst({
              where: {
                primaryUrl: { contains: urlSlug, mode: "insensitive" },
              },
              select: {
                roadmapPattern: { select: { name: true } },
              },
            });

            const topicTags = [...meta.topicTags];
            const patternName = roadmapHit?.roadmapPattern?.name;
            if (
              patternName &&
              !topicTags.some((t) => t.toLowerCase() === patternName.toLowerCase())
            ) {
              topicTags.push(patternName);
            }

            return NextResponse.json({
              results: [],
              enrichment: {
                title: meta.title,
                slug: meta.slug,
                url: raw,
                platform: "GFG",
                difficulty: meta.difficulty,
                topicTags,
                source: "gfg",
              },
            });
          }
        } finally {
          clearTimeout(timeout);
        }
      }
    }

    const asNum = parseInt(raw, 10);
    const isPureNumber = Number.isInteger(asNum) && asNum >= 0 && asNum <= 100_000 && /^\d+$/.test(raw);

    const numberMatches = isPureNumber
      ? await prisma.problem.findMany({
          where: { number: asNum },
          take: 5,
          select: problemSelect,
        })
      : [];

    const textMatches = await prisma.problem.findMany({
      where: {
        AND: [
          isPureNumber && numberMatches.length > 0 ? { id: { notIn: numberMatches.map((m) => m.id) } } : {},
          {
            OR: [
              { title: { contains: raw, mode: "insensitive" } },
              { slug: { startsWith: raw.toLowerCase() } },
            ],
          },
        ],
      },
      take: 10 - numberMatches.length,
      orderBy: [{ number: "asc" }],
      select: problemSelect,
    });

    return NextResponse.json({
      results: [...numberMatches, ...textMatches].map(serializeProblem),
    });
  } catch (err) {
    console.error("[api/search/problems]", err);
    return NextResponse.json({ results: [], error: "Search failed" }, { status: 500 });
  }
}
