import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { interleaveQueue, QueueItem } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id }
    });
    
    const cap = settings?.dailyReviewCap ?? 5;
    const now = new Date();

    const dueCards = await prisma.reviewCard.findMany({
      where: {
        entry: { userId: user.id },
        due: { lte: now },
      },
      include: {
        entry: {
          include: {
            problem: {
              include: {
                patterns: {
                  include: { pattern: true }
                }
              }
            }
          }
        }
      }
    });

    // Map to QueueItem for interleaving
    const items: QueueItem[] = dueCards.map(card => {
      const p = card.entry.problem;
      const primaryFamily = p.patterns.length > 0 ? p.patterns[0].pattern.family : null;
      
      return {
        entryId: card.entryId,
        due: card.due,
        lapses: card.lapses,
        reps: card.reps,
        family: primaryFamily,
        // Extra payload for UI
        problemId: p.id,
        title: p.title,
        number: p.number,
        url: p.url,
        difficulty: p.difficulty,
        platform: p.platform,
        mistake: card.entry.mistake,
        idea: card.entry.idea,
      };
    });

    const interleaved = interleaveQueue(items, cap, now);

    return NextResponse.json({ queue: interleaved });
  } catch (err) {
    console.error("[api/today/queue]", err);
    return NextResponse.json({ queue: [], error: String(err) }, { status: 500 });
  }
}
