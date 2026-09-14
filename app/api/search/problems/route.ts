import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Platform } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    const raw = typeof query === "string" ? query.trim() : "";

    if (!raw) {
      return NextResponse.json({ results: [] });
    }

    // 1. Check if input is a URL
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

    // 2. If it is a known slug from URL, lookup directly
    if (urlSlug) {
      const match = await prisma.problem.findFirst({
        where: {
          slug: urlSlug,
          ...(urlPlatform ? { platform: urlPlatform } : {}),
        },
        include: {
          patterns: {
            include: { pattern: true },
          },
        },
      });

      if (match) {
        return NextResponse.json({
          results: [
            {
              id: match.id,
              platform: match.platform,
              number: match.number,
              title: match.title,
              slug: match.slug,
              url: match.url,
              difficulty: match.difficulty,
              acRate: match.acRate,
              topicTags: match.topicTags,
              patterns: match.patterns.map((p) => ({
                id: p.pattern.id,
                name: p.pattern.name,
                family: p.pattern.family,
              })),
            },
          ],
        });
      }
    }

    // 3. Check for numeric match first (number === query)
    const asNum = parseInt(raw, 10);
    const isPureNumber = !isNaN(asNum) && /^\d+$/.test(raw);

    let numberMatches: any[] = [];
    if (isPureNumber) {
      numberMatches = await prisma.problem.findMany({
        where: { number: asNum },
        take: 5,
        include: {
          patterns: {
            include: { pattern: true },
          },
        },
      });
    }

    // 4. Text matches: title starts with or contains query, or slug starts with query
    const textMatches = await prisma.problem.findMany({
      where: {
        AND: [
          isPureNumber ? { id: { notIn: numberMatches.map((m) => m.id) } } : {},
          {
            OR: [
              { title: { startsWith: raw, mode: "insensitive" } },
              { title: { contains: raw, mode: "insensitive" } },
              { slug: { startsWith: raw.toLowerCase() } },
            ],
          },
        ],
      },
      take: 10 - numberMatches.length,
      orderBy: [{ number: "asc" }],
      include: {
        patterns: {
          include: { pattern: true },
        },
      },
    });

    const combined = [...numberMatches, ...textMatches];

    const results = combined.map((p) => ({
      id: p.id,
      platform: p.platform,
      number: p.number,
      title: p.title,
      slug: p.slug,
      url: p.url,
      difficulty: p.difficulty,
      acRate: p.acRate,
      topicTags: p.topicTags,
      patterns: p.patterns.map((pp: any) => ({
        id: pp.pattern.id,
        name: pp.pattern.name,
        family: pp.pattern.family,
      })),
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[api/search/problems]", err);
    return NextResponse.json({ results: [], error: String(err) }, { status: 500 });
  }
}
