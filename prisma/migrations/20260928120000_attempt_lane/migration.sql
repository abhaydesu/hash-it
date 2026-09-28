-- CreateEnum
CREATE TYPE "ReviewLane" AS ENUM ('RECALL', 'RESOLVE');

-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN "lane" "ReviewLane";

-- CreateIndex
CREATE INDEX "Attempt_at_idx" ON "Attempt"("at");

-- Backfill recall-lane attempts (only recordRecallAttempt writes these notes).
UPDATE "Attempt" SET "lane" = 'RECALL'
WHERE "minutes" IS NULL AND ("note" = 'Recall review' OR "note" LIKE 'Recall: %');
