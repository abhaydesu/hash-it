-- CreateIndex (before dropping the old one, so entryId lookups are always indexed)
CREATE INDEX "Attempt_entryId_at_idx" ON "Attempt"("entryId", "at");

-- DropIndex (covered by the composite index above)
DROP INDEX "Attempt_entryId_idx";

-- CreateIndex
CREATE INDEX "ProblemPattern_patternId_idx" ON "ProblemPattern"("patternId");
