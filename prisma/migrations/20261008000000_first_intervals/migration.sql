-- First-review waits for newly logged problems. Existing review cards are left where they are.
ALTER TABLE "UserSettings" ADD COLUMN "firstIntervalCold" INTEGER NOT NULL DEFAULT 14;
ALTER TABLE "UserSettings" ADD COLUMN "firstIntervalHint" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "UserSettings" ADD COLUMN "firstIntervalSolution" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "UserSettings" ADD COLUMN "firstIntervalFlagged" INTEGER NOT NULL DEFAULT 4;
