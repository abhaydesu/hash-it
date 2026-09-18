import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const DrillSchema = z.object({
  patternId: z.string().min(1),
  correct: z.boolean(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user;

  try {
    const data = DrillSchema.parse(await request.json());
    const pattern = await prisma.pattern.findUnique({ where: { id: data.patternId }, select: { id: true } });

    if (!pattern) {
      return NextResponse.json({ error: "Pattern not found" }, { status: 404 });
    }

    if (!user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const drill = await prisma.patternDrill.create({
      data: { userId: user.id, patternId: data.patternId, correct: data.correct },
    });

    return NextResponse.json({ id: drill.id, at: drill.at });
  } catch (err) {
    console.error("[api/review/weekly/drill]", err);
    return NextResponse.json({ error: "Failed to record drill" }, { status: 400 });
  }
}