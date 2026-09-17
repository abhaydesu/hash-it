import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Platform } from "@prisma/client";
import { LIMITS } from "@/lib/safe";

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
        if (parsedUrl.hostname.includes("leetcode.com")) {
          const parts = parsedUrl.pathname.split("/").filter(Boolean);
          const probIdx = parts.indexOf("problems");
          if (probIdx !== -1 && parts[probIdx + 1]) {
            urlSlug = parts[probIdx + 1];
            urlPlatform = Platform.LEETCODE;
          }
        } else if (parsedUrl.hostname.includes("geeksforgeeks.org")) {
          const parts = parsedUrl.pathname.split("/").filter(Boolean);
          if (parts.length > 0) {
            urlSlug = parts[parts.length - 1];
            urlPlatform = Platform.GFG;
          }
        } else {
          const parts = parsedUrl.pathname.split("/").filter(Boolean);
          if (parts.length > 0) {
            urlSlug = parts[parts.length - 1];
            urlPlatform = Platform.OTHER;
          }
        }
      } catch {
        // Not a valid URL, treat as plain text
      }
    }

    if (urlSlug) {
      const match = await prisma.problem.findFirst({
        where: {
          slug: urlSlug,
          ...(urlPlatform ? { platform: urlPlatform } : {}),
        },
        select: problemSelect,
      });

      if (match) {
        return NextResponse.json({ results: [serializeProblem(match)] });
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
