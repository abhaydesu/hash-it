ALTER TABLE "UserSettings" ADD COLUMN "dailyRecallCap" INTEGER NOT NULL DEFAULT 8;

-- Reset all existing accounts to the new shared defaults. Users have not
-- intentionally tuned these caps yet.
UPDATE "UserSettings" SET "dailyResolveCap" = 2, "dailyRecallCap" = 8;
