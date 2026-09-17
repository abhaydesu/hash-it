import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { DataTable } from "@/components/problem-grid/data-table";
import { ProblemGridRow } from "@/components/problem-grid/columns";
import { SheetSection } from "@/components/ui/sheet-section";

export const dynamic = "force-dynamic";

export default async function ProblemsPage() {
  const user = await getCurrentUser();

  const [entries, allPatterns] = await Promise.all([
    prisma.entry.findMany({
      where: { userId: user.id },
      include: {
        problem: {
          include: {
            patterns: {
              include: { pattern: true },
            },
          },
        },
        reviewCard: true,
      },
      orderBy: [{ firstSolvedAt: "desc" }],
    }),
    prisma.pattern.findMany({
      orderBy: [{ sortOrder: "asc" }],
      select: { name: true },
    }),
  ]);

  const rows: ProblemGridRow[] = entries.map((entry) => {
    const p = entry.problem;
    const card = entry.reviewCard;
    const sheetPatterns = p.patterns.map((pp) => pp.pattern.name);
    const effectivePatterns = entry.customPattern
      ? [entry.customPattern]
      : entry.patternOverride.length > 0
        ? entry.patternOverride
        : sheetPatterns;
    const primaryFamily = p.patterns.length > 0 ? p.patterns[0].pattern.family : null;

    return {
      id: entry.id,
      problemId: p.id,
      number: p.number,
      title: p.title,
      slug: p.slug,
      url: entry.customUrl || p.url,
      platform: p.platform,
      difficulty: p.difficulty,
      status: entry.status,
      revisit: entry.revisit,
      minutes: entry.minutes,
      idea: entry.idea,
      mistake: entry.mistake,
      patterns: effectivePatterns,
      family: primaryFamily,
      topicTags: entry.topic ? [entry.topic, ...p.topicTags] : p.topicTags,
      firstSolvedAt: entry.firstSolvedAt.toISOString(),
      due: card ? card.due.toISOString() : null,
      lapses: card?.lapses ?? 0,
      reps: card?.reps ?? 0,
      sourceList: entry.sourceList,
    };
  });

  return (
    <div>
      <SheetSection innerClassName="py-6">
        <h1 className="type-title text-foreground">Problems</h1>
        <p className="mt-1 type-caption">
          Dense spreadsheet view of all logged problems. Click ideas or mistakes to edit inline.
        </p>
      </SheetSection>
      <SheetSection innerClassName="pb-10 pt-2" band="none" last>
        <DataTable data={rows} patternsList={allPatterns.map((p) => p.name)} />
      </SheetSection>
    </div>
  );
}
