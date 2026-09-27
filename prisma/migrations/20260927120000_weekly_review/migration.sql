-- CreateEnum
CREATE TYPE "RecallConfidence" AS ENUM ('BLANK', 'HAZY', 'CLEAR');

-- CreateEnum
CREATE TYPE "PlanItemKind" AS ENUM ('REDO', 'FRESH', 'REVISIT');

-- DropForeignKey
ALTER TABLE "PatternDrill" DROP CONSTRAINT "PatternDrill_userId_fkey";

-- DropForeignKey
ALTER TABLE "PatternDrill" DROP CONSTRAINT "PatternDrill_patternId_fkey";

-- DropTable
DROP TABLE "PatternDrill";

-- CreateTable
CREATE TABLE "WeeklyCheck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" "RecallConfidence" NOT NULL,
    "recalled" BOOLEAN NOT NULL,

    CONSTRAINT "WeeklyCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "kind" "PlanItemKind" NOT NULL,
    "problemId" TEXT NOT NULL,

    CONSTRAINT "WeeklyPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyCheck_userId_weekStart_idx" ON "WeeklyCheck"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyCheck_entryId_weekStart_key" ON "WeeklyCheck"("entryId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPlan_userId_weekStart_key" ON "WeeklyPlan"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPlanItem_planId_kind_key" ON "WeeklyPlanItem"("planId", "kind");

-- AddForeignKey
ALTER TABLE "WeeklyCheck" ADD CONSTRAINT "WeeklyCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyCheck" ADD CONSTRAINT "WeeklyCheck_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPlan" ADD CONSTRAINT "WeeklyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPlanItem" ADD CONSTRAINT "WeeklyPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WeeklyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPlanItem" ADD CONSTRAINT "WeeklyPlanItem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

